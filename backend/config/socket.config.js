const { Server } = require("socket.io");
const redisClient = require("../redis/redisClient");

let io;

/**
 * Socket.io konfiguracija z multi-outlet sobami in opcijskim Redis adapterjem.
 *
 * Prejšnje stanje: vsi klienti so prejemali VSE dogodke (io.emit). Pri
 * multi-outlet postavitvi je kuhalnica lokacije A videla naročila lokacije B.
 *
 * Sedaj: vsak odjemalec se ob prijavi pridruži sobi `outlet:<outletId>` (iz
 * JWT uporabnika) in po potrebi še `outlet:global` za admin dashboard.
 * Helper `emitToOutlet(outletId, event, data)` pošlje dogodek samo v sobo
 * tega outlet-a; `emitGlobal` pošlje v vse (za admin / multi-outlet oversight).
 *
 * Horizontal scaling: če je Redis povezan, se samodejno priključi
 * @socket.io/redis-adapter. To omogoča, da več backend instanc (npr. v
 * Kubernetes clusterju) delijo Socket.io dogodke prek Redis pub/sub.
 * Brez adapterja dogodki ne preidejo med instancami — kuhalnica priključena
 * na instanco B ne bi videla naročila, ki je prišlo na instanco A.
 * Glej: https://socket.io/docs/v4/using-multiple-nodes
 */
const initSocket = (server) => {
    const allowedOrigins = [
        "http://localhost:5173",
        "https://tastystation.vercel.app",
        "tastystation.vercel.app",
        "https://www.tastystation.vercel.app",
        "www.tastystation.vercel.app"
    ];

    io = new Server(server, {
        cors: {
            origin: function (origin, callback) {
                if (!origin) return callback(null, true);
                if (allowedOrigins.indexOf(origin) === -1) {
                    var msg = 'The CORS policy for this site does not allow access from the specified Origin.';
                    return callback(new Error(msg), false);
                }
                return callback(null, true);
            },
            methods: ["GET", "POST", "PUT", "DELETE", "PATCH", "OPTIONS"],
            credentials: true
        }
    });

    // === Redis adapter za horizontal scaling ===
    // Če je Redis povezan in odprt, priključi adapter za multi-node broadcast.
    try {
        if (redisClient && redisClient.isOpen && process.env.REDIS_SKIP !== "true") {
            let adapter;
            try {
                adapter = require("@socket.io/redis-adapter");
            } catch (_e) {
                // Paket ni nameščen — single-node fallback
            }
            if (adapter) {
                const { createClient } = require("redis");
                // Uporabimo ločena pub/sub klienta (adapter to zahteva)
                const redisUrl = process.env.REDIS_URL || null;
                const pubClient = createClient(redisUrl ? { url: redisUrl } : {
                    socket: {
                        host: process.env.REDIS_HOST,
                        port: process.env.REDIS_PORT ? parseInt(process.env.REDIS_PORT) : 6379,
                    },
                    username: process.env.REDIS_USERNAME,
                    password: process.env.REDIS_PASSWORD,
                });
                const subClient = pubClient.duplicate();
                Promise.all([pubClient.connect(), subClient.connect()])
                    .then(() => {
                        io.adapter(adapter.createAdapter(pubClient, subClient));
                        console.log("Socket.io: Redis adapter attached (multi-node ready).");
                    })
                    .catch((err) => {
                        console.warn("Socket.io: Redis adapter failed (single-node):", err.message);
                    });
            } else {
                console.log("Socket.io: @socket.io/redis-adapter not installed — single-node mode.");
            }
        } else {
            console.log("Socket.io: Redis not connected — single-node mode.");
        }
    } catch (e) {
        console.log("Socket.io: Redis adapter setup error (single-node mode):", e.message);
    }

    console.log("Socket.io initialized (with per-outlet rooms).");

    io.on("connection", (socket) => {
        console.log(`Client connected: ${socket.id}`);

        socket.on("join-room", (room) => {
            if (typeof room !== "string" || !room) return;
            socket.join(room);
            console.log(`Socket ${socket.id} joined room ${room}`);
        });

        socket.on("leave-room", (room) => {
            if (typeof room !== "string") return;
            socket.leave(room);
            console.log(`Socket ${socket.id} left room ${room}`);
        });

        socket.on("join-outlet", (outletId) => {
            const room = outletId ? `outlet:${outletId}` : "outlet:global";
            socket.join(room);
            console.log(`Socket ${socket.id} joined outlet room ${room}`);
        });

        socket.on("disconnect", () => {
            console.log(`Client disconnected: ${socket.id}`);
        });
    });

    return io;
};

const getIo = () => {
    if (!io) {
        throw new Error("Socket.io not initialized!");
    }
    return io;
};

/**
 * Pošlje dogodek samo v sobo specifičnega outlet-a.
 *
 * Uporaba: emitToOutlet(order.outletId, "newOrder", populatedOrder)
 * - Kuhinja in blagajna na tem outlet-u vidijo dogodek.
 * - Drugi outlet-i NE vidijo (prava multi-outlet izolacija).
 * - Admin dashboard naj se pridruži tudi `outlet:global` če želi videti vse.
 *
 * @param {String|null|undefined} outletId — ObjectId (string) outlet-a
 * @param {String} event — Socket.io event ime
 * @param {*} data — payload
 */
const emitToOutlet = (outletId, event, data) => {
    if (!io) {
        console.warn("emitToOutlet: Socket.io not initialized — skipping emit.");
        return;
    }
    const room = outletId ? `outlet:${outletId}` : "outlet:global";
    io.to(room).emit(event, data);
    // Vedno pošlji tudi v global sobo — admin dashboard (ki ni vezan na en outlet)
    io.to("outlet:global").emit(event, data);
};

/**
 * Pošlje dogodek vsem prijavljenim odjemalcem (admin multi-outlet oversight).
 * Uporablja se za dogodke, ki niso vezani na specifičen outlet (npr. sistemska
 * obvestila). Za order/kitchen dogodke uporabljaj emitToOutlet.
 *
 * @param {String} event — Socket.io event ime
 * @param {*} data — payload
 */
const emitGlobal = (event, data) => {
    if (!io) {
        console.warn("emitGlobal: Socket.io not initialized — skipping emit.");
        return;
    }
    io.emit(event, data);
};

module.exports = { initSocket, getIo, emitToOutlet, emitGlobal };
