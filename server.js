require("dotenv").config();
const express = require("express");
const cors = require("cors");
const { Pool } = require("pg");

const app = express();
app.use(express.json());
app.use(cors());

// Connect to PostgreSQL using DATABASE_URL environment variable
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }
});

// Create the readings table if it does not exist
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

// Endpoint to receive data from ESP32 and store it in PostgreSQL
app.post("/data", async (req, res) => {
  try {
    const { tensiune, curent } = req.body;
    const putere = tensiune * curent; // Calculate power
    await pool.query(
      "INSERT INTO readings (voltage, current, power) VALUES ($1, $2, $3)",
      [tensiune, curent, putere]
    );
    res.json({ message: "Data successfully saved to the database!" });
  } catch (error) {
    console.error("Error saving data:", error);
    res.status(500).json({ error: "Failed to save data" });
  }
});

// Endpoint to fetch data for the application
app.get("/data", async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM readings ORDER BY timestamp DESC LIMIT 100");
    res.json(result.rows);
  } catch (error) {
    console.error("Error fetching data:", error);
    res.status(500).json({ error: "Failed to retrieve data" });
  }
});

// Start the server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Server is running on port ${PORT}`);
});
