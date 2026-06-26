const mongoose = require("mongoose");

/**
 * Reward — nagrade, ki jih lahko stranka izkoristi s točkami.
 *
 * Primeri:
 *   - Free Coffee (100 točk) → popust 200 Rs
 *   - Free Dessert (150 točk) → popust 300 Rs
 *   - 10% off entire bill (300 točk) → 10% popust
 *   - Free Meal (500 točk) → popust 800 Rs
 */
const rewardSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Reward name is required"],
        trim: true
    },
    description: {
        type: String,
        trim: true
    },
    pointsCost: {
        type: Number,
        required: [true, "Points cost is required"],
        min: 1
    },
    type: {
        type: String,
        enum: ["fixed_discount", "percentage_discount", "free_item", "free_shipping"],
        required: true
    },
    value: {
        type: Number,
        default: 0,
        min: 0
    },
    menuItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuItem",
        default: null
    },
    category: {
        type: String,
        enum: ["food", "drinks", "discount", "other"],
        default: "discount"
    },
    icon: {
        type: String,
        default: "🎁"
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, { timestamps: true });

const Reward = mongoose.models.Reward || mongoose.model("Reward", rewardSchema);
module.exports = Reward;
