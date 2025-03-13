require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { MongoClient } = require("mongodb");

const app = express();
app.use(express.json());
app.use(cors());

// MongoDB Connection
const mongoURI = process.env.MONGO_URI || "mongodb+srv://mihnea1009:1UKM8WyP2BkJ87oG@solarsensecluster.5utcd.mongodb.net/?retryWrites=true&w=majority&appName=solarsensecluster";
const client = new MongoClient(mongoURI);

let database;
client.connect()
    .then(() => {
        console.log("✅ Connected to MongoDB");
        database = client.db("solar-data"); // Database name
    })
    .catch(err => console.error("❌ MongoDB Connection Error:", err));

// Endpoint to receive data from ESP32
app.post("/data", async (req, res) => {
    try {
        console.log("📡 Data received from ESP32:", req.body);
        const collection = database.collection("measurements"); // Collection name
        await collection.insertOne({ ...req.body, timestamp: new Date() });
        res.json({ message: "✅ Data saved to MongoDB" });
    } catch (err) {
        console.error("❌ Error saving data:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Endpoint to fetch the latest data
app.get("/data", async (req, res) => {
    try {
        const collection = database.collection("measurements");
        const latestData = await collection.find().sort({ timestamp: -1 }).limit(1).toArray();
        res.json(latestData[0] || {});
    } catch (err) {
        console.error("❌ Error fetching data:", err);
        res.status(500).json({ error: "Internal Server Error" });
    }
});

// Endpoint to fetch historical data
app.get("/history", async (req, res) => {
    try {
        const collection = database.collection("measurements");
        const dataHistory = await collection.find().sort({ timestamp: -1 }).limit(100).toArray();
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
