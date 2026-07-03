const mongoose = require("mongoose");

/**
 * StockMovement — audit trail vseh sprememb zaloge.
 *
 * Vsaka sprememba Inventory.quantity se zabeleži tukaj. To omogoča:
 *   1. Sledljivost — kdor spremeni zalogo, pusti sled (user, reason, timestamp)
 *   2. Poročanja — poraba po obdobju, najboljša/najslabša prodaja
 *   3. Inventario — fizično štetje vs. sistemsko stanje
 *   4. Waste tracking — kvantifikacija odpadkov
 *
 * Tipi gibanj (type):
 *   - "order"       — avtomatska poraba ob createOrder (preko Recipe BoM)
 *   - "restock"     — ročna dopolnitev zaloge (od dobavitelja)
 *   - "waste"       — odpis (zaprtež, iztek roka, poškodba)
 *   - "adjustment"  — ročna korekcija (inventario, popravki)
 *   - "transfer"    — prenos med outlet-i (multi-outlet)
 *   - "return"      — vračilo (preklican order, nepravilna dobava)
 *
 * Reference: Toast POS "stock movements", Apicbase "inventory audit".
 */
const stockMovementSchema = new mongoose.Schema({
    // Inventory postavka, ki se je spremenila
    inventory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Inventory",
        required: true,
        index: true,
    },
    // Snapshot imena (za primer, če se inventory izbriše)
    inventoryName: {
        type: String,
        required: true,
    },
    // Tip gibanja (glej zgoraj)
    type: {
        type: String,
        enum: ["order", "restock", "waste", "adjustment", "transfer", "return"],
        required: true,
        index: true,
    },
    // Količina spremembe: pozitivna = prirastek, negativna = poraba/odpis
    // (npr. -2.5 za porabo 2.5kg beef-a, +50 za restock 50 kosov)
    quantityChange: {
        type: Number,
        required: true,
    },
    // Zaloga PRED spremembo (za audit trail)
    quantityBefore: {
        type: Number,
        required: true,
        min: 0,
    },
    // Zaloga PO spremembi
    quantityAfter: {
        type: Number,
        required: true,
        min: 0,
    },
    // Enota (snapshot iz inventory.unit)
    unit: {
        type: String,
        required: true,
    },
    // Povezani order (samo za type="order" in type="return")
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        default: null,
    },
    // OrderItem snapshot (za type="order" — kateri menu item je povzročil porabo)
    menuItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuItem",
        default: null,
    },
    menuItemName: {
        type: String,
        default: null,
    },
    // Outlet, na katerem se je zgodila sprememba
    outlet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Outlet",
        default: null,
        index: true,
    },
    // Uporabnik, ki je sprožil spremembo
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    userName: {
        type: String,
        default: null,
    },
    // Razlog (obvezen za waste/adjustment, opcijski za ostale)
    reason: {
        type: String,
        trim: true,
        default: "",
    },
    // Cena na enoto ob času gibanja (snapshot za costing analizo)
    costPerUnit: {
        type: Number,
        default: 0,
        min: 0,
    },
    // Skupna vrednost gibanja (|quantityChange| × costPerUnit)
    totalValue: {
        type: Number,
        default: 0,
    },
}, { timestamps: true });

// Indexi za pogoste poizvedbe
stockMovementSchema.index({ createdAt: -1 });
stockMovementSchema.index({ inventory: 1, createdAt: -1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });
stockMovementSchema.index({ outlet: 1, createdAt: -1 });

const StockMovement = mongoose.models.StockMovement || mongoose.model("StockMovement", stockMovementSchema);
module.exports = StockMovement;
