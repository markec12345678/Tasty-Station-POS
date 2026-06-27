const mongoose = require("mongoose");

const orderSchema = new mongoose.Schema({
    orderId: {
        type: String,
        unique: true,
        // We'll generate this in the controller (e.g., ORD-timestamp-random)
    },
    type: {
        type: String,
        enum: ["Dine-in", "Takeaway"],
        required: [true, "Order type is required"]
    },
    status: {
        type: String,
        enum: ["Pending", "Preparing", "Ready", "Completed", "Cancelled"],
        default: "Pending"
    },
    paymentMethod: {
        type: String,
        enum: ["Cash", "Card", "Online", "Split"],
        default: "Cash"
    },
    // Split payment support — array vseh plačil za ta račun
    payments: [{
        method: {
            type: String,
            enum: ["Cash", "Card", "Online"],
            required: true
        },
        amount: { type: Number, required: true, min: 0 },
        reference: { type: String, default: null },
        timestamp: { type: Date, default: Date.now }
    }],
    amountPaid: { type: Number, default: 0, min: 0 },
    balanceDue: {
        type: Number,
        default: function() { return this.totalAmount || 0; },
        min: 0
    },
    items: [{
        menuItem: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "MenuItem",
            required: true
        },
        name: String, // Snapshot of name at time of order
        price: Number, // Base price (snapshot)
        quantity: {
            type: Number,
            required: true,
            min: 1
        },
        // === Modifier selections ===
        modifiers: [{
            groupName: { type: String, required: true },
            modifierName: { type: String, required: true },
            priceAdjustment: { type: Number, default: 0 },
            priceOverride: { type: Number, default: null },
        }],
        // === Course routing ===
        // Course number: 1=predjed, 2=glavna jed, 3=desert
        // Kuhinja prejme course 1, ko je pripravljen, nato course 2, itd.
        course: {
            type: Number,
            default: 1,
            min: 1,
            max: 5,
        },
        // Ali je ta item že poslan v kuhinjo
        sentToKitchen: {
            type: Boolean,
            default: false,
        },
        // Končna cena tega artikla z modifikatorji (base price + vsi adjustments)
        unitPrice: Number,
        // Skupna cena za to postavko (unitPrice × quantity)
        lineTotal: Number,
    }],
    totalAmount: {
        type: Number,
        required: true,
        min: 0
    },
    // === Service Charge (avto-dodajanje servisa) ===
    // Samodejno se doda za večje skupine (npr. 10% za >6 oseb)
    serviceCharge: {
        type: Number,
        default: 0,
        min: 0,
    },
    serviceChargeRate: {
        type: Number, // procent (npr. 10 = 10%)
        default: 0,
    },
    // Končni znesek = subtotal + tax + serviceCharge - discount
    finalTotal: {
        type: Number,
        default: function() { return this.totalAmount; },
        min: 0,
    },
    client: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Client",
        required: [true, "Client is required for the order"]
    },
    clientName: String, // Snapshot for history
    clientPhone: String, // Snapshot for history
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        // Staff member who processed the order
    },
    table: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Table",
        // Optional: only for Dine-in
    }
}, { timestamps: true });

// Compound index for optimizing order queries (e.g. fetching 'Pending' orders sorted by newest first)
orderSchema.index({ status: 1, createdAt: -1 });

const Order = mongoose.models.Order || mongoose.model("Order", orderSchema);
module.exports = Order;
