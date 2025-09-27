const express = require('express');
const app = express();
const cors = require('cors');
const { MongoClient, ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json());

// Root route handler to avoid 'Cannot GET /' error
app.get('/', (req, res) => {
  res.send('Welcome to AI Stethoscope Backend');
});

// MongoDB Atlas Connection URI with your encoded password and database name
const uri = 'mongodb+srv://gr9832791_db_user:Gowtham%400923@cluster0.ujfng1a.mongodb.net/healthDB?retryWrites=true&w=majority&appName=Cluster0';

const client = new MongoClient(uri);
let db, patientsCol, readingsCol;

async function connectDB() {
  try {
    await client.connect();
    db = client.db('healthDB');
    patientsCol = db.collection('patients');
    readingsCol = db.collection('readings'); // Collection for historical readings
    console.log('Connected to MongoDB Atlas');
  } catch (err) {
    console.error('Failed to connect to MongoDB', err);
  }
}
connectDB();

// Add patient (with patientId from frontend)
app.post('/addPatient', async (req, res) => {
  const { patientId, name, age, gender } = req.body;
  if (!patientId || !name || !age || !gender) {
    return res.status(400).json({ message: 'Missing patient data including patientId' });
  }
  try {
    const result = await patientsCol.insertOne({ patientId, name, age, gender, createdAt: new Date() });
    res.status(200).json({ message: 'Patient added', patientId: result.insertedId });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Add reading from Arduino (no patientId in request)
app.post('/addReading', async (req, res) => {
  const { bpm, spo2 } = req.body;
  if (typeof bpm !== 'number' || typeof spo2 !== 'number') {
    return res.status(400).json({ message: 'Invalid or missing sensor data' });
  }
  try {
    // Find latest patient to associate reading with
    const latestPatient = await patientsCol.findOne({}, { sort: { createdAt: -1 } });
    if (!latestPatient) {
      return res.status(400).json({ message: 'No patient found. Add a patient first.' });
    }
    // Insert reading as historical record
    await readingsCol.insertOne({
      patientId: latestPatient.patientId,
      bpm,
      spo2,
      timestamp: new Date()
    });
    // Update latest reading on patient doc for dashboard
    await patientsCol.updateOne(
      { _id: latestPatient._id },
      { $set: { bpm, spo2, lastReadingTimestamp: new Date() } }
    );
    res.status(200).json({ message: 'Reading saved' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get latest patients (with latest readings)
app.get('/readings', async (req, res) => {
  try {
    const patients = await patientsCol.find().sort({ createdAt: -1 }).toArray();
    res.status(200).json(patients);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get patient details by patientId
app.get('/getPatientById', async (req, res) => {
  const { patientId } = req.query;
  if (!patientId) {
    return res.status(400).json({ message: 'Missing patientId query parameter' });
  }
  try {
    const patient = await patientsCol.findOne({ patientId });
    if (!patient) {
      return res.status(404).json({ message: 'Patient not found' });
    }
    res.json(patient);
  } catch (err) {
    console.error(err);
    res.status(500).json({ message: 'Server error' });
  }
});

// Get reading history for a patient
app.get('/readingsHistory', async (req, res) => {
  const { patientId } = req.query;
  if (!patientId) return res.status(400).json({ message: 'Missing patientId' });
  try {
    const readings = await readingsCol.find({ patientId }).sort({ timestamp: 1 }).toArray();
    res.json(readings);
  } catch (err) {
    res.status(500).json({ message: 'Server error' });
  }
});

// Download CSV of patient reading history
app.get('/historyCsv', async (req, res) => {
  const { patientId } = req.query;
  if (!patientId) return res.status(400).send('Missing patientId');
  try {
    const readings = await readingsCol.find({ patientId }).sort({ timestamp: 1 }).toArray();
    let csv = 'timestamp,bpm,spo2\n' +
      readings.map(r =>
        `${new Date(r.timestamp).toISOString()},${r.bpm},${r.spo2}`
      ).join('\n');
    res.header('Content-Type', 'text/csv');
    res.attachment(`patient_${patientId}_history.csv`);
    res.send(csv);
  } catch (err) {
    res.status(500).send('Server error');
  }
});

app.listen(3000, () => console.log('Server running on port 3000'));
