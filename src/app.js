import express from "express";
import cors from "cors";
import { MongoClient, ObjectId } from "mongodb";
import dotenv from "dotenv";
import joi from "joi";
import dayjs from "dayjs";

const app = express();

app.use(cors());
app.use(express.json());
dotenv.config();
dayjs().format();

const mongoClient = new MongoClient(process.env.DATABASE_URL);
try {
    await mongoClient.connect();
    console.log("MongoDB conectado!");
} catch (err) {
    console.log(err.message);
}
const db = mongoClient.db()

app.post("/participants", async (req, res) => {

    const name = req.body;

    const nameSchema = joi.object({
        name: joi.string().required()
    })

    const validation = nameSchema.validate(name, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    try {

        const participant = await db.collection("participants").findOne(name);
        if (participant) return res.status(409).send("Este participante já existe!");

        await db.collection("participants").insertOne({ name: name.name, lastStatus: Date.now() });
        await db.collection("messages").insertOne({
            from: name.name,
            to: "Todos",
            text: "entra na sala...",
            type: "status",
            time: `${dayjs().format("HH:mm:ss")}`
        })

        res.sendStatus(201);

    } catch (err) {
        res.status(500).send(err.message);
    }
});


const PORT = 5005; // A PORTA AO ENTREGAR DEVE SER 5000
app.listen(PORT, console.log(`Server online on port: ${PORT}`));