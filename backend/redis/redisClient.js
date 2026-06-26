const { createClient } = require('redis');

const clientOptions = {
    socket: {
        connectTimeout: 3000, // 3 seconds timeout
        reconnectStrategy: (retries) => {
            if (retries > 3) {
                // Ne vrzemo Errorja — samo neha ponovno se povezovati.
                // Cache se enostavno izklopi; backend nadaljuje delo.
                console.warn('⚠️  Redis: unavailable after 3 retries — cache disabled (backend continues).');
                return false;
            }
            return Math.min(retries * 100, 1000);
        }
    }
};

if (process.env.REDIS_URL) {
    clientOptions.url = process.env.REDIS_URL;
} else {
    clientOptions.username = process.env.REDIS_USERNAME;
    clientOptions.password = process.env.REDIS_PASSWORD;
    clientOptions.socket.host = process.env.REDIS_HOST;
    clientOptions.socket.port = process.env.REDIS_PORT;
}

const redisClient = createClient(clientOptions);

redisClient.on('error', err => console.log('❌ Redis Client Error', err));

redisClient.on('connect', () => console.log('⌚ Redis Client Connecting...'));

redisClient.on('ready', () => console.log('✅ Redis Client Ready'));

(async () => {
    // V test ali dev mode brez Redis host-a sploh ne poizkušamo povezati —
    // backend deluje brez cache-a, kar je za dev OK.
    const skipRedis = process.env.NODE_ENV === 'test'
        || process.env.REDIS_SKIP === 'true'
        || (!process.env.REDIS_URL && !process.env.REDIS_HOST);

    if (skipRedis) {
        console.log('ℹ️  Redis skipped (set REDIS_HOST or REDIS_URL to enable caching).');
        return;
    }

    try {
        await redisClient.connect();
    } catch (err) {
        console.error('❌ Redis Connection Failed', err.message);
    }
})();

/**
 * Delete keys matching a pattern
 * @param {string} pattern - Redis key pattern (e.g., 'cache:/api/menu*')
 */
redisClient.delByPattern = async (pattern) => {
    if (!redisClient.isOpen) return;

    try {
        let cursor = '0'; // Start with string '0'
        do {
            const reply = await redisClient.scan(cursor, {
                MATCH: pattern,
                COUNT: 100
            });
            cursor = String(reply.cursor); // Convert to string
            const keys = reply.keys;

            if (keys.length > 0) {
                await redisClient.del(keys);
            }
        } while (cursor !== '0'); // Compare with string '0'
    } catch (err) {
        console.error(`❌ Redis delByPattern Error (${pattern}):`, err);
    }
};

module.exports = redisClient;