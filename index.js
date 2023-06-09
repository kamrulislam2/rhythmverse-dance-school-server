const express = require("express");
const app = express();
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
require("dotenv").config();
const morgan = require("morgan");
const port = process.env.PORT || 5000;

// Middleware functions
app.use(cors());
app.use(express.json());
app.use(morgan("dev"));

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
    await client.connect();

    const classesCollection = client.db("rhythmVerseDB").collection("classes");
    const usersCollection = client.db("rhythmVerseDB").collection("users");

    //  Class or instructors api
    app.get("/popular-classes", async (req, res) => {
      const limit = parseInt(req.query.limit) || 0;
      const result = await classesCollection
        .find()
        .sort({ students: -1 })
        .limit(limit)
        .toArray();
      res.send(result);
    });

    // Add users
    app.put("/users", async (req, res) => {
      const user = req.body;
      const filter = { email: user.email };
      const options = { upsert: true };
      const updateDoc = {
        $set: {
          name: user.name,
          email: user.email,
        },
      };

      const result = await usersCollection.updateOne(
        filter,
        updateDoc,
        options
      );
      res.send(result);
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
