require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(express.json());

// Configure CORS settings
app.use(cors({
    origin: "*", // Allow all origins (Expo, localhost, etc.)
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

// Connect to PostgreSQL database
const pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
});

// Create table if it does not exist
pool.query(`
  CREATE TABLE IF NOT EXISTS readings (
    id SERIAL PRIMARY KEY,
    timestamp TIMESTAMPTZ DEFAULT NOW(),
    voltage REAL,
    current REAL,
    power REAL
  );
`, (err, res) => {
    if (err) console.error("Error creating table:", err);
    else console.log("Readings table is ready!");
});

// Endpoint to receive data from ESP32 and save it to PostgreSQL
app.post("/data", async (req, res) => {
    try {
        const { tensiune, curent } = req.body;
        const putere = tensiune * curent; // Calculate power
        await pool.query(
            "INSERT INTO readings (voltage, current, power) VALUES ($1, $2, $3)",
            [tensiune, curent, putere]
        );
        res.json({ message: "Data received and saved successfully!" });
    } catch (error) {
        console.error("Error saving data:", error);
        res.status(500).json({ error: "Failed to save data" });
    }
});

// Endpoint to retrieve the latest data for the application
app.get("/data", async (req, res) => {
    try {
        const result = await pool.query("SELECT * FROM readings ORDER BY timestamp DESC LIMIT 100");
        res.json(result.rows);
    } catch (error) {
        console.error("Error retrieving data:", error);
        res.status(500).json({ error: "Failed to retrieve data" });
    }
});

// Endpoint for server health check
app.get("/", (req, res) => {
    res.send("Server for photovoltaic panels is running!");
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
