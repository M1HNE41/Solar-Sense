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

// Create HTTP server and WebSocket server
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
  },
});

// When a client connects
io.on("connection", (socket) => {
  console.log("Client connected:", socket.id);

  // Send the latest data every 2 seconds
  const interval = setInterval(async () => {
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

// API routes
app.get("/", (req, res) => res.send("Server is running!"));
app.post("/api/data", async (req, res) => {
    console.log("📡 Received from ESP32:", req.body); // Debugging log
    const { voltage, current, power } = req.body;

    try {
        const newData = new SensorData({ voltage, current, power });
        await newData.save();
        
        // Send real-time update via WebSocket
        io.emit("updateData", [newData]); 

        res.json({ message: "Data received", data: newData });
    } catch (err) {
        console.error("Error saving data:", err);
        res.status(500).send("Server Error");
    }
});

const PORT = process.env.PORT || 5000;
server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
