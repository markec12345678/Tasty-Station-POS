const mongoose = require("mongoose");
const bcrypt = require("bcryptjs");

const userSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Name is required"],
        trim: true
    },
    email: {
        type: String,
        required: [true, "Email is required"],
        unique: true,
        trim: true,
        lowercase: true,
        match: [/^[\w-.]+@([\w-]+\.)+[\w-]{2,4}$/, "Please fill a valid email address"]
    },
    password: {
        type: String,
        required: [true, "Password is required"]
    },
    pin: {
        type: String,
        trim: true,
        // Optional: length validation
    },
    role: {
        type: String,
        enum: ["admin", "manager", "cashier", "waiter", "kitchen", "client"],
        default: "client"
    },
    designation: {
        type: String,
        trim: true
    },
    permissions: [{
        type: String
    }],
    shift: {
        start: String,
        end: String
    },
    phoneNumber: {
        type: String,
        trim: true
    },
    avatar: {
        type: String,
        default: ""
    },
    isActive: {
        type: Boolean,
        default: true
    },
    // === Multi-outlet sync ===
    outletId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Outlet",
        default: null,
    },
    // === Push notifications ===
    pushToken: {
        type: String,
        default: null,
        trim: true,
    },
}, {
    timestamps: true
});

userSchema.pre("save", async function () {
    if (this.isModified("password")) {
        this.password = await bcrypt.hash(this.password, 10);
    }
    // Hash PIN-a pri shranjevanju (prejšnje stanje: plaintext — varnostna luknja).
    // PIN je občutljiv tudi zato, ker omogoča hitri login na POS terminalu.
    if (this.isModified("pin") && this.pin) {
        this.pin = await bcrypt.hash(this.pin, 10);
    }
});

userSchema.methods.comparePassword = async function (password) {
    return await bcrypt.compare(password, this.password);
}

// Varna primerjava PIN-a (bcrypt). Ker so PIN-i hashirani, jih ne moremo
// iskati z direktnim queryjem (findOne({ pin })) — uporabimo comparePin.
userSchema.methods.comparePin = async function (pin) {
    if (!this.pin || !pin) return false;
    try {
        return await bcrypt.compare(pin, this.pin);
    } catch {
        return false;
    }
};

const User = mongoose.models.User || mongoose.model("User", userSchema);
module.exports = User;

