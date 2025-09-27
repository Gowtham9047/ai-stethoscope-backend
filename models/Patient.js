const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const Patient = require("./models/Patient");

const app = express();
app.use(express.json());
app.use(cors());

// Temporary variable to hold latest ESP32 readings
let latestSensorData = { bpm: null, spo2: null };

// Endpoint for ESP32 to send data (runs in background)
app.post("/sensor", (req, res) => {
  const { bpm, spo2 } = req.body;
  latestSensorData = { bpm, spo2 };
  console.log("Updated sensor data:", latestSensorData);
  res.status(200).json({ message: "Sensor data received" });
});

// Add Patient (with latest sensor values)
app.post("/addPatient", async (req, res) => {
  try {
    const { name, age, gender } = req.body;

    if (!latestSensorData.bpm || !latestSensorData.spo2) {
      return res.status(400).json({ message: "No sensor data available" });
    }

    const patient = new Patient({
      name,
      age,
      gender,
      bpm: latestSensorData.bpm,
      spo2: latestSensorData.spo2
    });

    await patient.save();
    res.status(200).json(patient);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// Get all patients
app.get("/patients", async (req, res) => {
  try {
    const patients = await Patient.find().sort({ createdAt: -1 });
    res.json(patients);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

mongoose.connect("mongodb://127.0.0.1:27017/healthDB")
  .then(() => app.listen(3000, () => console.log("Server running on port 3000")))
  .catch(err => console.error(err));
