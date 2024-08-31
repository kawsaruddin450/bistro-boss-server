const express = require('express');
require('dotenv').config();
const { MongoClient, ServerApiVersion, ObjectId } = require('mongodb');
const cors = require('cors');
const app = express();
const port = process.env.PORT || 8000;

app.use(cors());
app.use(express.json());

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
        const reviewCollection = client.db("bistroDB").collection("reviews");
        const cartCollection = client.db("bistroDB").collection("carts");
        
        // get all menu from db
        app.get('/menu', async(req, res)=> {
            const result = await menuCollection.find().toArray();
            res.send(result);
        })

        // get all reviews from db
        app.get('/reviews', async(req, res)=> {
            const result = await reviewCollection.find().toArray();
            res.send(result);
        })

        //get cart data of specific user
        app.get('/carts', async(req, res) => {
            const email = req.query.email;
            let query = {}
            if(!email){
                res.send([]);
            }
            else if(email){
                query = {email: email};
            }
            const result = await cartCollection.find(query).toArray();
            res.send(result);
        })

        // post cart data
        app.post('/carts', async(req, res)=> {
            const item = req.body;
            const result = await cartCollection.insertOne(item);
            res.send(result);
        })

        //delete an item from cart
        app.delete('/carts/:id', async(req, res) => {
            const id = req.params.id;
            const query = {_id: new ObjectId(id)};
            const result = await cartCollection.deleteOne(query);
            res.send(result);
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
})