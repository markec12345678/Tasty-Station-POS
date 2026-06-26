const mongoose = require("mongoose");
const logger = require("../../utils/logger");

/**
 * Poveže se na MongoDB.
 *
 * 1. Poskusi z MONGO_URI iz env (pravi MongoDB / Docker).
 * 2. Če ni dosegljiv (dev brez MongoDB), samodejno preklopi na
 *    mongodb-memory-server (in-memory) — app še vedno deluje,
 *    podatki so pa izgubljeni ob restartu.
 */
const connectDB = async () => {
    // Idempotentno — če smo že povezani, ne počnemo ničesar
    if (mongoose.connection.readyState === 1) {
        return;
    }

    const uri = process.env.MONGO_URI || "mongodb://localhost:27017/tastystation";

    try {
        await mongoose.connect(uri, {
            serverSelectionTimeoutMS: 3000, // hitro faila če MongoDB ni tam
        });
        logger.info(`MongoDB connected: ${uri}`);
        return;
    } catch (err) {
        logger.warn(`Primary MongoDB unreachable (${uri}): ${err.message}`);
        logger.warn("⏳ Falling back to in-memory MongoDB (dev only)…");

        try {
            const { MongoMemoryServer } = require("mongodb-memory-server");
            const mongod = await MongoMemoryServer.create();
            const memoryUri = mongod.getUri();
            await mongoose.connect(memoryUri);
            logger.info(`✅ In-memory MongoDB started: ${memoryUri}`);
            logger.warn("⚠️  Data will be LOST on restart. For persistence install MongoDB or run: docker compose up -d");
        } catch (memErr) {
            logger.error(`In-memory MongoDB failed: ${memErr.message}`);
            process.exit(1);
        }
    }
};

module.exports = connectDB;
