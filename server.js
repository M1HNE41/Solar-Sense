require("dotenv").config();
const express = require("express");
const cors = require("cors");

const app = express();
app.use(express.json());
app.use(cors());

let ledState = false; // Variabilă care ține minte dacă LED-ul e aprins sau stins

// Endpoint pentru a primi date de la ESP32
app.post("/data", (req, res) => {
    console.log("Date primite de la ESP32:", req.body);
    res.json({ message: "Date primite!" });
});

// Endpoint pentru controlul LED-ului
app.get("/led", (req, res) => {
    const { state } = req.query;
    if (state === "on") {
        ledState = true;
    } else if (state === "off") {
        ledState = false;
    }
    res.json({ led: ledState });
});

// Testare server
app.get("/", (req, res) => {
    res.send("Serverul ESP32 merge!");
});

// Pornire server
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
    console.log(`Serverul rulează pe portul ${PORT}`);
});
