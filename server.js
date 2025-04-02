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
  timestamp: { type: Date, default: Date.now },
});

const SensorData = mongoose.model("sensordatas", sensorDataSchema, "sensordatas");

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// Track last ESP update
let lastEspUpdateTime = Date.now();

io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send initial data on connect
  SensorData.find().sort({ timestamp: -1 }).limit(50)
    .then((latestData) => {
      console.log("Sending initial data to client...");
      socket.emit("updateData", latestData);
    })
    .catch((err) => console.error("Error fetching initial data:", err));

  // Periodic updates only if ESP is active
  const interval = setInterval(async () => {
    const now = Date.now();
    const isEspActive = now - lastEspUpdateTime < 10000; // 10s

    if (!isEspActive) {
      console.log("⚠️ ESP inactive, skipping data push");
      return;
    }

    try {
      const latestData = await SensorData.find().sort({ timestamp: -1 }).limit(50);
      console.log("📤 Sending new data to client...");
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

app.post("/api/data", async (req, res) => {
  console.log("📡 Received from ESP32:", req.body);
  const { voltage, current, power } = req.body;

  try {
    const newData = new SensorData({ voltage, current, power });
    await newData.save();

    // Update last ESP time
    lastEspUpdateTime = Date.now();

    // Immediate push
    io.emit("updateData", [newData]);

    res.json({ message: "Data received", data: newData });
  } catch (err) {
    console.error("Error saving data:", err);
    res.status(500).send("Server Error");
  }
});

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

app.get("/api/data", async (req, res) => {
  try {
    const data = await SensorData.find().sort({ timestamp: -1 }).limit(50);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching historical data:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
