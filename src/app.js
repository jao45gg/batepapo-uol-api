import express from "express";
import cors from "cors";
import { MongoClient } from "mongodb";
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
const db = mongoClient.db();

setInterval(async () => {

    const participants = await db.collection("participants").find().toArray();

    for (let index = 0; index < participants.length; index++) {

        if (participants[index].lastStatus < (Date.now() - 10000)) {

            await db.collection("participants").deleteOne({ name: participants[index].name });
            await db.collection("messages").insertOne({
                from: participants[index].name,
                to: 'Todos',
                text: 'sai da sala...',
                type: 'status',
                time: `${dayjs().format("HH:mm:ss")}`
            });
        }
    }

}, 15000);

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

app.get("/participants", async (req, res) => {
    try {
        const participants = await db.collection("participants").find().toArray();
        res.send(participants);
    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.post("/messages", async (req, res) => {

    const user = req.headers.user;
    const participant = await db.collection("participants").findOne({ name: user });
    if (!participant) return res.status(404).send("Participante não encontrado!");

    const message = req.body;
    message.from = user;

    const messageSchema = joi.object({
        from: joi.string().required(),
        to: joi.string().required(),
        text: joi.string().required(),
        type: joi.string().valid("message", "private_message").required()
    })

    const validation = messageSchema.validate(message, { abortEarly: false });

    if (validation.error) {
        const errors = validation.error.details.map((detail) => detail.message);
        return res.status(422).send(errors);
    }

    try {

        message.time = dayjs().format("HH:mm:ss");
        await db.collection("messages").insertOne(message);
        res.sendStatus(201);

    } catch (err) {
        res.status(500).send(err.message);
    }
});

app.get("/messages", async (req, res) => {

    const user = req.headers.user;
    const participant = await db.collection("participants").findOne({ name: user });
    if (!participant) return res.status(404).send("Participante não encontrado!");

    const limit = req.query.limit;
    if (limit <= 0 || (isNaN(limit) && limit !== undefined)) return res.status(422).send("Valor de limit inválido!");

    try {

        const messages = await db.collection("messages").find({ $or: [{ to: "Todos" }, { to: user }, { from: user }] }).toArray();
        if (limit === undefined) return res.send(messages);
        res.send(messages.slice(-limit));

    } catch (err) {
        res.status(500).send(err.message);
    }

});

app.post("/status", async (req, res) => {

    const user = req.headers.user;
    const participant = await db.collection("participants").findOne({ name: user });
    if (!participant) return res.sendStatus(404);

    try {

        const newParticipant = participant;
        newParticipant.lastStatus = Date.now();
        await db.collection("participants").updateOne({ name: participant.name }, { $set: newParticipant });
        res.sendStatus(200);

    } catch (err) {
        res.status(500).send(err.message);
    }
});

const PORT = 5005; // A PORTA AO ENTREGAR DEVE SER 5000
app.listen(PORT, console.log(`Server online on port: ${PORT}`));