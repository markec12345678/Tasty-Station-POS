const { Server } = require("socket.io");

let io;

/**
 * Socket.io konfiguracija z multi-outlet sobami.
 *
 * Prejšnje stanje: vsi klienti so prejemali VSE dogodke (io.emit). Pri
 * multi-outlet postavitvi je kuhalnica lokacije A videla naročila lokacije B.
 *
 * Sedaj: vsak odjemalec se ob prijavi pridruži sobi `outlet:<outletId>` (iz
 * JWT uporabnika) in po potrebi še `outlet:global` za admin dashboard.
 * Helper `emitToOutlet(outletId, event, data)` pošlje dogodek samo v sobo
 * tega outlet-a; `emitGlobal` pošlje v vse (za admin / multi-outlet oversight).
 */
const initSocket = (server) => {
    // Array of allowed origins matching the main server configuration
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

    console.log("Socket.io initialized (with per-outlet rooms).");

    io.on("connection", (socket) => {
        console.log(`Client connected: ${socket.id}`);

        // Splošni room join (backward-compat s staro uporabo "join-room")
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

        // Specifičen join za outlet sobo — frontend ga kliče ob avtentikaciji.
        // Pošlje se `outletId` (string ObjectId ali null). Če je null, se
        // pridruži `outlet:global` (admin dashboard, ki vidi vse outlete).
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
