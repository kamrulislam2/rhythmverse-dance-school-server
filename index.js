const express = require("express");
const app = express();
const cors = require("cors");
const port = process.env.PORT || 3000;

// Middleware functions
app.use(cors());
app.use(express.json());

// Initial get & listen
app.get("/", (req, res) => {
  res.send("RhythmVerse is running...");
});

app.listen(port, () => {
  console.log(`${port} port is working`);
});
