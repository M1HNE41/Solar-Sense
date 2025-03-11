require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());

// 🔹 Configurează CORS corect
app.use(cors({
    origin: "*", // Permite orice sursă (Expo, localhost, etc.)
    methods: ["GET", "POST"],
    allowedHeaders: ["Content-Type"]
}));

let latestData = { tensiune: 0, curent: 0, putere: 0 }; // Inițializare variabile

// 🔹 Endpoint pentru a primi date de la ESP32
app.post("/data", (req, res) => {
    console.log("📡 Date primite de la ESP32:", req.body);
    latestData = req.body; // Salvăm ultimele date primite
    res.json({ message: "✅ Date primite!" });
});

// 🔹 Endpoint pentru a trimite date către aplicație
app.get("/data", (req, res) => {
    res.setHeader("Access-Control-Allow-Origin", "*"); // 🔹 Fix pentru CORS
    res.json(latestData);
});

// 🔹 Endpoint de testare
app.get("/", (req, res) => {
    res.send("✅ Serverul pentru panouri fotovoltaice este activ!");
});

// 🔹 Pornire server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`✅ Serverul rulează pe portul ${PORT}`);
});
