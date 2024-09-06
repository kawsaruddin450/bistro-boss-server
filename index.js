const express = require('express');
require('dotenv').config();
const jwt = require('jsonwebtoken');
const stripe = require("stripe")(process.env.PAYMENT_SECRET_KEY);
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

const verifyJWT = (req, res, next) => {
    const authorization = req.headers.authorization;
    if (!authorization) {
        return res.status(401).send({ error: true, message: "unauthorized access" });
    }
    const token = authorization.split(' ')[1];

    jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
        if (err) {
            return res.status(401).send({ error: true, message: "unauthorized access" });
        }
        req.decoded = decoded;
        next();
    })
}



app.get('/', (req, res) => {
    res.send(`Bistro Boss Server is running at: ${port}`)
})



const uri = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.5xew4.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Create a MongoClient with a MongoClientOptions object to set the Stable API version
const client = new MongoClient(uri, {
    serverApi: {
        version: ServerApiVersion.v1,
        strict: true,
        deprecationErrors: true,
    }
});

async function run() {
    try {
        // Connect the client to the server	(optional starting in v4.7)
        await client.connect();

        const menuCollection = client.db("bistroDB").collection("menu");
        const usersCollection = client.db("bistroDB").collection("users");
        const reviewCollection = client.db("bistroDB").collection("reviews");
        const cartCollection = client.db("bistroDB").collection("carts");
        const paymentCollection = client.db("bistroDB").collection("payments");


        const verifyAdmin = async (req, res, next) => {
            const email = req.decoded.email;
            const query = { email: email };
            const result = await usersCollection.findOne(query);
            if (result?.role !== "admin") {
                return res.status(403).send({ error: true, message: "forbidden access" });
            }
            next();
        }

        // get all menu from db
        app.get('/menu', async (req, res) => {
            const result = await menuCollection.find().toArray();
            res.send(result);
        });

        //add a menu item
        app.post('/menu', verifyJWT, verifyAdmin, async (req, res) => {
            console.log(req.headers.authorization);
            const menuItem = req.body;
            const result = await menuCollection.insertOne(menuItem);
            res.send(result);
        });

        //delete a menu item
        app.delete('/menu/:id', verifyJWT, verifyAdmin, async(req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await menuCollection.deleteOne(query);
            res.send(result);
        });

        //jwt
        app.post('/jwt', (req, res) => {
            const user = req.body;
            const token = jwt.sign(user, process.env.ACCESS_TOKEN_SECRET, { expiresIn: '1h' });
            res.send({ token });
        })

        //get all users
        app.get('/users', async (req, res) => {
            const result = await usersCollection.find().toArray();
            res.send(result);
        });

        //Post api for a user
        app.post('/users', async (req, res) => {
            const user = req.body;
            const query = { email: user.email };
            const existingUser = await usersCollection.findOne(query);
            if (existingUser) {
                return res.send({ message: "User already exists!" })
            }
            const result = await usersCollection.insertOne(user);
            res.send(result);
        });

        //check if admin or not
        app.get('/users/admin/:email', verifyJWT, async (req, res) => {
            const email = req.params.email;

            if (req.decoded.email !== email) {
                return res.status(403).send({ error: true, message: "Forbidden Access" });
            }
            const query = { email: email };
            const user = await usersCollection.findOne(query);
            const result = { admin: user?.role === 'admin' };
            res.send(result);
        })

        //make admin api
        app.patch('/users/admin/:id', async (req, res) => {
            const id = req.params.id;
            const filter = { _id: new ObjectId(id) };
            const updateRole = {
                $set: {
                    role: `admin`
                },
            };
            const result = await usersCollection.updateOne(filter, updateRole);
            res.send(result);
        });

        // get all reviews from db
        app.get('/reviews', async (req, res) => {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        });

        //get cart data of specific user
        app.get('/carts', verifyJWT, async (req, res) => {
            const email = req.query.email;
            let query = {}
            if (!email) {
                res.send([]);
            }

            const decodedEmail = req.decoded.email;
            if (decodedEmail !== email) {
                return res.status(403).send({ error: true, message: "forbidden access" });
            }

            else if (email) {
                query = { email: email };
            }
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        });

        // post cart data
        app.post('/carts', async (req, res) => {
            const item = req.body;
            const result = await cartCollection.insertOne(item);
            res.send(result);
        });

        //delete an item from cart
        app.delete('/carts/:id', async (req, res) => {
            const id = req.params.id;
            const query = { _id: new ObjectId(id) };
            const result = await cartCollection.deleteOne(query);
            res.send(result);
        });

        //create payment intent api
        app.post('/create-payment-intent', verifyJWT, async(req, res)=> {
            const {price} = req.body;
            const amount = price*100;
            const paymentIntent =await stripe.paymentIntents.create({
                amount: amount,
                currency: 'usd',
                payment_method_types: ['card']
            });
            res.send({
                clientSecret: paymentIntent.client_secret
            })
        })

        //save payment data to database and delete cart items paid
        app.post('/payments', verifyJWT, async (req, res) => {
            const payment = req.body;
            const insertedResult = await paymentCollection.insertOne(payment);

            const query = {_id: { $in: payment.items.map(id => new ObjectId(id))}};
            const deletedResult = await cartCollection.deleteMany(query);

            res.send({insertedResult, deletedResult});
        })


        // Send a ping to confirm a successful connection
        await client.db("admin").command({ ping: 1 });
        console.log("Pinged your deployment. You successfully connected to MongoDB!");
    } finally {
        // Ensures that the client will close when you finish/error
    }
}
run().catch(console.dir);


app.listen(port, () => {
    console.log("Bistro Boss Server is running at:", port);
});