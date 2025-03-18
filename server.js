const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
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

// Root route to check if the server is running
app.get("/", (req, res) => {
  res.send("Server is running!");
});

// Endpoint to receive and store sensor data from ESP32
app.post("/api/data", async (req, res) => {
  const { voltage, current, power } = req.body;
  try {
    const newData = new SensorData({ voltage, current, power });
    await newData.save();
    res.json(newData);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Endpoint to retrieve the most recent 50 data points
app.get("/api/data", async (req, res) => {
  try {
    const data = await SensorData.find().sort({ timestamp: -1 }).limit(50);
    res.json(data);
  } catch (err) {
    console.error(err);
    res.status(500).send("Server Error");
  }
});

// Endpoint to retrieve all historical sensor data sorted chronologically
app.get("/api/data/historical", async (req, res) => {
  try {
    const historicalData = await SensorData.find().sort({ timestamp: 1 });
    res.status(200).json(historicalData);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: "Server Error" });
  }
});

//Endpoint to retrieve sensor data within a specific time range
app.get("/api/data/range", async (req, res) => {
  const { start, end } = req.query;

  if (!start || !end) {
    return res.status(400).json({ message: "Missing start or end date parameter" });
  }

  try {
    const startDate = new Date(start);
    const endDate = new Date(end);

    // Validate if the dates are valid
    if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
      return res.status(400).json({ message: "Invalid date format" });
    }

    // Fetch data in the date range
    const rangeData = await SensorData.find({
      timestamp: {
        $gte: startDate, // Greater than or equal to start date
        $lte: endDate,   // Less than or equal to end date
      },
    }).sort({ timestamp: 1 });

    res.status(200).json(rangeData);
  } catch (err) {
    console.error("Error fetching data by range:", err);
    res.status(500).json({ message: "Server Error" });
  }
});

const PORT = process.env.PORT || 5000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
