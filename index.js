const express = require("express");
const app = express();
const cors = require("cors");
const jwt = require("jsonwebtoken");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
require("dotenv").config();
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const morgan = require("morgan");
const port = process.env.PORT || 5000;

// Middleware functions
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

// verifyJWT function
const verifyJWT = (req, res, next) => {
  const authorization = req.headers.authorization;
  if (!authorization) {
    return res
      .status(401)
      .send({ error: true, message: "Unauthorized Access" });
  }
  const token = authorization.split(" ")[1];

  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (error, decoded) => {
    if (error) {
      return res
        .status(401)
        .send({ error: true, message: "Unauthorized Access" });
    }
    req.decoded = decoded;
    next();
  });
};

// Mongodb
const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.towmtg1.mongodb.net/?retryWrites=true&w=majority`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    // Connect the client to the server	(optional starting in v4.7)
    // await client.connect();

    const classesCollection = client.db("rhythmVerseDB").collection("classes");
    const usersCollection = client.db("rhythmVerseDB").collection("users");
    const selectedCollection = client
      .db("rhythmVerseDB")
      .collection("selected");
    const paymentsCollection = client
      .db("rhythmVerseDB")
      .collection("payments");
    const classUpdatesCollection = client
      .db("rhythmVerseDB")
      .collection("classUpdates");

    const verifyAdmin = async (req, res, next) => {
      const email = req.decoded.email;

      const query = { email: email };
      const user = await usersCollection.findOne(query);
      if (user?.role !== "admin") {
        res.status(403).send({ error: true, message: "Access Forbidden" });
      }
      next();
    };

    // JWT Token

    app.post("/jwt", (req, res) => {
      const user = req.body;
      const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: "1h",
      });

      res.send({ token });
    });

    //  Class or instructors api
    app.get("/classes", async (req, res) => {
      const query = { status: "Approved" };
      const limit = parseInt(req.query.limit) || 0;
      const result = await classesCollection
        .find(query)
        .sort({ students: -1 })
        .limit(limit)
        .toArray();
      res.send(result);
    });

    app.get("/myClasses", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const filter = { "instructor.email": email };
      const cursor = classesCollection.find(filter);
      const result = await cursor.toArray();
      res.send(result);
    });

    app.get("/manageClasses", verifyJWT, verifyAdmin, async (req, res) => {
      const query = { status: "Pending" };
      const pendingClasses = await classesCollection
        .find(query)
        .sort({ students: -1 })
        .toArray();
      res.send(pendingClasses);
    });

    app.get("/updatedClasses", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await classUpdatesCollection
        .find()
        .sort({ students: -1 })
        .toArray();
      res.send(result);
    });

    app.patch(
      "/manageClasses/:id",
      verifyJWT,
      verifyAdmin,
      async (req, res) => {
        const { updateStatus, classUpdateData } = req.body;
        const id = req.params.id;
        const filter = { _id: new ObjectId(id) };
        const updateDoc = {
          $set: {
            status: updateStatus.status,
          },
        };
        const updateResult = await classesCollection.updateOne(
          filter,
          updateDoc
        );

        const addResult = await classUpdatesCollection.insertOne(
          classUpdateData
        );

        res.send({ updateResult, addResult });
      }
    );

    app.put("/updateFeedback/:id", verifyJWT, verifyAdmin, async (req, res) => {
      const updateFeedback = req.body;
      const id = req.params.id;
      const filterClasses = { _id: new ObjectId(id) };
      const filterClassUpdates = { classId: id };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          feedback: updateFeedback.feedback,
        },
      };
      const classesResult = await classesCollection.updateOne(
        filterClasses,
        updateDoc,
        options
      );
      const classUpdatesResult = await classUpdatesCollection.updateOne(
        filterClassUpdates,
        updateDoc,
        options
      );
      res.send({ classesResult, classUpdatesResult });
    });

    app.patch("/myClasses/:id", verifyJWT, async (req, res) => {
      const updateData = req.body;
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          seats: updateData.seats,
          price: updateData.price,
        },
      };
      const result = await classesCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.delete("/myClasses/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await classesCollection.deleteOne(filter);
      res.send(result);
    });

    app.post("/classes", async (req, res) => {
      const classData = req.body;

      const result = await classesCollection.insertOne(classData);
      res.send(result);
    });

    app.patch("/classes/:id", async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const findClass = await classesCollection.findOne(filter);
      console.log(findClass);
      const updateDoc = {
        $set: {
          students: findClass.students + 1,
        },
      };
      const updateResult = await classesCollection.updateOne(filter, updateDoc);
      res.send(updateResult);
    });

    // Users API
    app.get("/users", verifyJWT, verifyAdmin, async (req, res) => {
      const result = await usersCollection.find().toArray();
      res.send(result);
    });

    app.patch("/user/:id", async (req, res) => {
      const id = req.params.id;
      const updateRole = req.body;
      const filter = { _id: new ObjectId(id) };
      const updateDoc = {
        $set: {
          role: updateRole.role,
        },
      };
      const result = await usersCollection.updateOne(filter, updateDoc);
      res.send(result);
    });

    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          name: user.name,
          email: user.email,
          image: user.image,
          role: "student",
        },
      };
      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
    });

    // Student selected data
    app.get("/selected", verifyJWT, async (req, res) => {
      const email = req.query.email;
      console.log(email);
      const filter = { email: email };
      const result = await selectedCollection.find(filter).toArray();
      res.send(result);
    });

    // This route is to load data in payment page to get price information
    app.get("/selected/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };
      const result = await selectedCollection.findOne(filter);
      res.send(result);
    });

    app.post("/selected", async (req, res) => {
      const data = req.body;

      console.log(data);
      const filter = { name: data.name, email: data.email };
      const findData = await selectedCollection.findOne(filter);
      if (findData) {
        return res.send("Already Exists");
      }
      const result = await selectedCollection.insertOne(data);
      res.send(result);
    });

    app.delete("/selected/:id", verifyJWT, async (req, res) => {
      const id = req.params.id;
      const filter = { _id: new ObjectId(id) };

      const result = await selectedCollection.deleteOne(filter);
      res.send(result);
    });

    // Instructor checking API
    app.get("/users/instructor/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ instructor: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      const result = { instructor: user?.role === "instructor" };
      res.send(result);
    });

    // Admin checking API
    app.get("/users/admin/:email", verifyJWT, async (req, res) => {
      const email = req.params.email;

      if (req.decoded.email !== email) {
        res.send({ admin: false });
      }
      const query = { email: email };
      const user = await usersCollection.findOne(query);

      const result = { admin: user?.role === "admin" };
      res.send(result);
    });

    // Create Payment intent
    app.post("/create-payment-intent", verifyJWT, async (req, res) => {
      const { price } = req.body;

      const amount = parseInt(price * 100);
      const paymentIntent = await stripe.paymentIntents.create({
        amount: amount,
        currency: "USD",
        payment_method_types: ["card"],
      });
      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Payment API
    app.get("/payment", verifyJWT, async (req, res) => {
      const email = req.query.email;
      const filter = { email: email };
      const result = await paymentsCollection
        .find(filter)
        .sort({ date: -1 })
        .toArray();
      res.send(result);
    });

    app.post("/payments", verifyJWT, async (req, res) => {
      const payment = req.body;
      const insertResult = await paymentsCollection.insertOne(payment);

      const query = {
        _id: new ObjectId(payment.selectedClassId),
      };
      const deleteResult = await selectedCollection.deleteMany(query);
      res.send({ insertResult, deleteResult });
    });

    // Send a ping to confirm a successful connection
    await client.db("admin").command({ ping: 1 });
    console.log(
      "Pinged your deployment. You successfully connected to MongoDB!"
    );
  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}
run().catch(console.dir);

// Initial get & listen
app.get("/", (req, res) => {
  res.send("RhythmVerse is running...");
});

app.listen(port, () => {
  console.log(`${port} port is working`);
});
