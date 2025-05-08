const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const { Server } = require("socket.io");
const http = require("http");
const path = require("path");
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
const otaCommands = {};

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
    if (!isEspActive) return;

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

// POST sensor data
app.post("/api/data", async (req, res) => {
  const { voltage, current, power, esp_id } = req.body;
  const espId = (esp_id || "").toUpperCase();

  if (!espId) return res.status(400).json({ error: "Missing espId" });

  try {
    const newData = new SensorData({ voltage, current, power, espId });
    await newData.save();
    lastEspUpdateTime = Date.now();
    const recentData = await SensorData.find({
      timestamp: { $gte: new Date(Date.now() - 10000) } // latest 10s
    }).sort({ timestamp: -1 });

    io.emit("updateData", recentData);


    if (otaCommands[espId]) {
      const command = otaCommands[espId];
      delete otaCommands[espId];
      return res.json({ command });
    }

    res.json({ message: "Data received", data: newData });
  } catch (err) {
    console.error("Error saving data:", err);
    res.status(500).send("Server Error");
  }
});

// OTA
app.post("/api/prepare-ota", (req, res) => {
  const { espId, firmwareUrl } = req.body;
  if (!espId || !firmwareUrl) {
    return res.status(400).json({ error: "espId and firmwareUrl required" });
  }
  otaCommands[espId.toUpperCase()] = firmwareUrl;
  res.json({ message: `OTA prepared for ${espId}` });
});

app.post("/api/reset-device", (req, res) => {
  const rawId = req.body.espId;
  if (!rawId) return res.status(400).json({ error: "espId is required" });

  const espId = rawId.toUpperCase();
  otaCommands[espId] = "reset";
  res.json({ message: `Reset command sent to ${espId}` });
});

// GET latest data
app.get("/api/data", async (req, res) => {
  try {
    const data = await SensorData.find().sort({ timestamp: -1 }).limit(50);
    res.status(200).json(data);
  } catch (error) {
    console.error("Error fetching latest data:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// GET data aggregated over a time range
app.get("/api/data/range", async (req, res) => {
  const { start, end, mode, espId } = req.query;

  if (!start || !end) {
    return res.status(400).json({ message: "Start and end timestamps are required." });
  }

  const startDate = new Date(start);
  const endDate = new Date(end);

  const matchStage = {
    timestamp: { $gte: startDate, $lte: endDate },
  };

  if (espId) {
    matchStage.espId = espId.toUpperCase();
  }

  const groupBy = (mode === 'weekly' || mode === 'monthly')
    ? {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' }
      }
    : {
        year: { $year: '$timestamp' },
        month: { $month: '$timestamp' },
        day: { $dayOfMonth: '$timestamp' },
        hour: { $hour: '$timestamp' }
      };

  try {
    const result = await SensorData.aggregate([
      { $match: matchStage },
      {
        $group: {
          _id: groupBy,
          totalEnergy: { $sum: { $multiply: ["$power", 5 / 3600] } },
          timestamp: { $min: "$timestamp" }
        }
      },
      { $sort: { timestamp: 1 } }
    ]);

    const formatted = result.map(item => ({
      time: item.timestamp,
      energy: parseFloat(item.totalEnergy.toFixed(2))
    }));

    res.json(formatted);
  } catch (error) {
    console.error("Aggregation error:", error);
    res.status(500).json({ message: "Server Error" });
  }
});

// GET distinct ESPs
app.get("/api/esps", async (req, res) => {
  try {
    const list = await SensorData.distinct("espId");
    res.json(list.sort());
  } catch (err) {
    console.error("Error getting ESP list:", err);
    res.status(500).json({ error: "Server Error" });
  }
});

// OTA binary file
app.get("/firmware/latest.bin", (req, res) => {
  const filePath = path.join(__dirname, "firmware", "latest.bin");
  res.sendFile(filePath);
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
