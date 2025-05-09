const express = require('express');
const cors = require('cors');
const jwt = require("jsonwebtoken");
const cookieParser = require('cookie-parser');
const app = express();
require('dotenv').config();

const port = process.env.PORT || 5000;
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');

app.use(cors({
  origin: ['http://localhost:5173', 'https://assignment-11-4d65a.web.app', 'https://assignment-11-4d65a.firebaseapp.com'],
  credentials: true
}));
app.use(express.json());
app.use(cookieParser());

const verifyToken = (req, res, next)=>{
  const token = req?.cookies?.token;
  if(!token){
    return res.status(401).send({message: 'Unauthorized access'})
  }
  
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET,(err, decoded)=>{
    if(err){
      return res.status(401).send({ message: 'Unauthorized access'})
    }
    req.user = decoded;
    next();
  })
}

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
    // await client.connect();
    console.log("Connected to MongoDB!");
    
    // marathon's related apis
    const db = client.db('MarathonManagementSystem');
    const marathonsCollection = db.collection('marathons');
    const usersCollection = db.collection('users');
    const registrationsCollection = db.collection('registrations');

    //auth related apis
    app.post('/jwt', (req, res) =>{
       const user = req.body;
       const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, {
        expiresIn: '10h'});
  
        res.cookie('token',token,{
          httpOnly: true,
          secure: process.env.NODE_ENV === "production",
          sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
        })
        .send({success: true})
       })

    app.post('/logout',(req, res)=>{
      res.clearCookie('token', {
         httpOnly: true,
         secure: process.env.NODE_ENV === "production",
         sameSite: process.env.NODE_ENV === "production" ? "none" : "strict",
      })
      .send({success: true})
    })
    

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

    // Update a marathon
    app.put("/marathons/:id", async (req, res) => {
      const id = req.params.id;
      const updatedMarathon = req.body;
      const query = { _id: new ObjectId(id) };
      const update = {
        $set: {
          name: updatedMarathon.name,
          date: updatedMarathon.date,
          location: updatedMarathon.location,
          description: updatedMarathon.description,
        },
      };

      const result = await marathonsCollection.updateOne(query, update);
      res.send(result);
    });

    // Delete a marathon
    app.delete("/marathons/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await marathonsCollection.deleteOne(query);
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

      // Check if the user is already registered for the marathon
      const existingRegistration = await registrationsCollection.findOne({
        email: registration.email,
        marathonId: registration.marathonId,
      });

      if (existingRegistration) {
        return res.status(400).send({ message: "You have already registered for this marathon." });
      }

      const result = await registrationsCollection.insertOne({
        ...registration,
      });
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

    // Get all marathons a user has applied for (filter by email)
    app.get('/registrations', verifyToken, async (req, res) => {
      const { email } = req.query; // Get email from query parameters

      // token email !== query email
      if(req.user.email !== req.query.email){
        return res.status(403).send({message: 'forbidden access'});
      }

      if (!email) {
        return res.status(400).json({ message: "Email is required" });
      }
      try {
        const registrations = await registrationsCollection.find({ email }).toArray();
        res.status(200).json(registrations);
      } catch (error) {
        res.status(500).json({ message: "Error fetching registrations." });
      }
    });

    // Delete a user's registration by email
    app.delete("/registrations/:id", async (req, res) => {
      const { id } = req.params; // Get the registration ID from URL params
      try {
        const result = await registrationsCollection.deleteOne({ _id: new ObjectId(id) });
        if (result.deletedCount === 0) {
          return res.status(404).json({ message: "Registration not found." });
        }
        res.status(200).json({ message: "Registration deleted successfully." });
      } catch (error) {
        res.status(500).json({ message: "Error deleting registration." });
      }
    });

    // Update a user's marathon registration
  app.put("/registrations/:id", async (req, res) => {
  const { id } = req.params;
  const { marathonTitle, startDate, firstName, lastName, contactNumber } = req.body;

  if (!marathonTitle || !startDate || !firstName || !lastName || !contactNumber) {
    return res.status(400).json({ message: "All fields are required." });
  }

  try {
    const result = await registrationsCollection.updateOne(
      { _id: new ObjectId(id) },
      {
        $set: {
          marathonTitle,
          startDate,
          firstName,
          lastName,
          contactNumber,
        }
      }
    );

    if (result.modifiedCount === 0) {
      return res.status(404).json({ message: "Registration not found or no changes made." });
    }

    res.status(200).json({ message: "Registration updated successfully." });
  } catch (error) {
    res.status(500).json({ message: "Error updating registration." });
  }
});

  } finally {
    // Ensure the client will close when finished or upon error
    // await client.close();
  }
}

run().catch(console.dir);

app.get('/', (req, res) => {
  res.send('Marathon Management System is working');
});

app.listen(port, () => {
  console.log(`Server is running on port: ${port}`);
});
