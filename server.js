require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());

// CORS configuration
app.use((req, res, next) => {
    res.header("Access-Control-Allow-Origin", req.headers.origin || "*");
    res.header("Access-Control-Allow-Methods", "GET, POST, OPTIONS");
    res.header("Access-Control-Allow-Headers", "Content-Type, Authorization");
    if (req.method === "OPTIONS") {
        return res.status(200).end();
    }
    next();
});

let latestData = { voltage: 0, current: 0, power: 0 };

// Endpoint to receive data from ESP32
app.post("/data", (req, res) => {
    console.log("Data received from ESP32:", req.body);
    latestData = req.body; // Store the latest received data
    res.json({ message: "Data received successfully" });
});

// Endpoint to send data to the application
app.get("/data", (req, res) => {
    res.header("Access-Control-Allow-Origin", "*");
    res.json(latestData);
});

// Health check endpoint
app.get("/", (req, res) => {
    res.send("Server for photovoltaic monitoring is active");
});

// Start server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
