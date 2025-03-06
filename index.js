const express = require('express');
const cors = require('cors');
const app = express();
require('dotenv').config();

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors());
app.use(express.json());

const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.3yfc6.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

const client = new MongoClient(uri, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  }
});

async function run() {
  try {
    await client.connect();
    console.log("Connected to MongoDB!");

    const db = client.db('MarathonManagementSystem');
    const marathonsCollection = db.collection('marathons');
    const usersCollection = db.collection('users');
    const registrationsCollection = db.collection('registrations'); 

    // Get all marathons (Home - limit 6)
    app.get('/marathons/home', async (req, res) => {
      const cursor = marathonsCollection.find().limit(6);
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get all marathons
    app.get('/marathons', async (req, res) => {
      const cursor = marathonsCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Get a single marathon by ID
    app.get("/marathons/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await marathonsCollection.findOne(query);
      res.send(result);
    });

    // Add a new marathon
    app.post("/marathons", async (req, res) => {
      const newMarathon = req.body;
      newMarathon.totalRegistrations = 0; // Initialize registration count
      const result = await marathonsCollection.insertOne(newMarathon);
      res.send(result);
    });

    // Get all users
    app.get("/users", async (req, res) => {
      const cursor = usersCollection.find();
      const result = await cursor.toArray();
      res.send(result);
    });

    // Create a new user
    app.post("/users", async (req, res) => {
      const newUser = req.body;
      console.log("Creating new user:", newUser);
      const result = await usersCollection.insertOne(newUser);
      res.send(result);
    });

    // Get a user by email
    app.get("/users/:email", async (req, res) => {
      const email = req.params.email;
      const query = { email: email };
      const user = await usersCollection.findOne(query);
      res.send(user);
    });

    // Register a user for a marathon
    app.post("/registrations", async (req, res) => {
      const registration = req.body;
      
      const existingRegistration = await registrationsCollection.findOne({
        email: registration.email,
        marathonId: registration.marathonId,
      });

      if (existingRegistration) {
        return res.status(400).send({ message: "You have already registered for this marathon." });
      }

      const result = await registrationsCollection.insertOne(registration);
      res.send(result);
    });

    // Update registration count in a marathon
    app.patch("/marathons/:id/updateRegistrationCount", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const update = { $inc: { totalRegistrations: 1 } };

      const result = await marathonsCollection.updateOne(query, update);
      res.send(result);
    });

  } finally {
    // Ensures that the client will close when you finish/error
    // await client.close();
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Marathon Management System is working');
});

app.listen(port, () => {
  console.log(`People are waiting for start running at: ${port}`);
});
