require("dotenv").config();
const express = require("express");
const cors = require("cors");
const mongoose = require("mongoose");

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection
const mongoURI = process.env.MONGO_URI || "mongodb+srv://mihnea1009:1UKM8WyP2BkJ87oG@solarsensecluster.5utcd.mongodb.net/?retryWrites=true&w=majority&appName=solarsensecluster";

mongoose.connect(mongoURI, { useNewUrlParser: true, useUnifiedTopology: true })
    .then(() => console.log("✅ MongoDB Connected"))
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Define Schema and Model
const DataSchema = new mongoose.Schema({
    tensiune: Number,
    curent: Number,
    putere: Number,
    timestamp: { type: Date, default: Date.now }
});

const DataModel = mongoose.model("Measurement", DataSchema);

// Endpoint to receive data from ESP32
app.post("/data", async (req, res) => {
    try {
        console.log("📡 Data received from ESP32:", req.body);
        const newData = new DataModel(req.body);
        await newData.save();
        res.json({ message: "✅ Data saved to MongoDB" });
    } catch (err) {
        console.error("❌ Error saving data:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Endpoint to fetch the latest data
app.get("/data", async (req, res) => {
    try {
        const latestData = await DataModel.findOne().sort({ timestamp: -1 });
        res.json(latestData || {});
    } catch (err) {
        console.error("❌ Error fetching data:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Endpoint to fetch historical data
app.get("/history", async (req, res) => {
    try {
        const dataHistory = await DataModel.find().sort({ timestamp: -1 }).limit(100);
        res.json(dataHistory);
    } catch (err) {
        console.error("❌ Error fetching history:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Start Server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Server running on port ${PORT}`);
});
