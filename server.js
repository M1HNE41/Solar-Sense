const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
require("dotenv").config();

const app = express();
app.use(cors());
app.use(express.json());

mongoose.connect(process.env.MONGO_URI, {
  useNewUrlParser: true,
  useUnifiedTopology: true,
});

const sensorDataSchema = new mongoose.Schema({
  voltage: Number,
  current: Number,
  power: Number,
  espId: String,
  timestamp: { type: Date, default: Date.now },
});

const SensorData = mongoose.model("sensordatas", sensorDataSchema, "sensordatas");

const server = http.createServer(app);
const io = new Server(server, {
  cors: { origin: "*" },
});

let lastEspUpdateTime = Date.now();

// OTA command store (in-memory)
const otaCommands = {}; // { "espId": "firmwareUrl" }

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  SensorData.find().sort({ timestamp: -1 }).limit(50)
    .then((latestData) => {
      socket.emit("updateData", latestData);
    })
    .catch((err) => console.error("Error fetching initial data:", err));

  const interval = setInterval(async () => {
    const now = Date.now();
    const isEspActive = now - lastEspUpdateTime < 10000;

    if (!isEspActive) {
      return;
    }

    try {
      const latestData = await SensorData.find().sort({ timestamp: -1 }).limit(50);
      socket.emit("updateData", latestData);
    } catch (error) {
      console.error("Error fetching real-time data:", error);
    }
  }, 2000);

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
    clearInterval(interval);
  });
});

app.get("/", (req, res) => res.send("Server is running!"));

// Endpoint for ESP to post data and receive OTA command if available
app.post("/api/data", async (req, res) => {
  const { voltage, current, power, espId } = req.body;

  try {
    const newData = new SensorData({ voltage, current, power, espId });
    await newData.save();
    lastEspUpdateTime = Date.now();
    io.emit("updateData", [newData]);

    // Check if there is a pending OTA command for this ESP
    if (espId && otaCommands[espId]) {
      const otaUrl = otaCommands[espId];
      delete otaCommands[espId];
      return res.json({ command: "ota", url: otaUrl });
    }

    res.json({ message: "Data received", data: newData });
  } catch (err) {
    console.error("Error saving data:", err);
    res.status(500).send("Server Error");
  }
});

// Endpoint to prepare an OTA command for a specific ESP
app.post("/api/prepare-ota", (req, res) => {
  const { espId, firmwareUrl } = req.body;

  if (!espId || !firmwareUrl) {
    return res.status(400).json({ error: "espId and firmwareUrl required" });
  }

  otaCommands[espId] = firmwareUrl;
  console.log(`OTA command set for ${espId}: ${firmwareUrl}`);
  res.json({ message: `OTA prepared for ${espId}` });
});

// Endpoint to fetch historical data in a given time range
app.get("/api/data/range", async (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ message: "Start and end timestamps are required." });
  }

  try {
    const historicalData = await SensorData.find({
      timestamp: { $gte: new Date(start), $lte: new Date(end) },
    }).sort({ timestamp: 1 });

    res.status(200).json(historicalData);
  } catch (error) {
    console.error("Error fetching historical data:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// Endpoint to fetch latest 50 entries
app.get("/api/data", async (req, res) => {
  try {
    const data = await SensorData.find().sort({ timestamp: -1 }).limit(50);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching latest data:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
