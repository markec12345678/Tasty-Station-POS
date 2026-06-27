const mongoose = require("mongoose");

/**
 * ModifierGroup — skupina modifikatorjev za artikel.
 *
 * Primeri:
 *   - "Cook Temperature" (Required, Single): Rare / Medium / Medium Well / Well Done
 *   - "Extras" (Optional, Multiple): Extra Cheese +2€ / Bacon +3€ / Mushrooms +1.5€
 *   - "Sauce" (Required, Single): Ketchup / Mayo / BBQ / Garlic
 *   - "Remove Ingredients" (Optional, Multiple): No Onions / No Pickles / No Tomato
 *   - "Size" (Required, Single): Small / Regular / Large (vsaka spremeni ceno)
 *
 * Pravila:
 *   - required: ali mora gost izbrati vsaj eno opcijo
 *   - selectionType: "single" (radio) ali "multiple" (checkbox)
 *   - maxSelections: za multiple — max število izbire (0 = neomejeno)
 */
const modifierGroupSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Modifier group name is required"],
        trim: true,
    },
    description: {
        type: String,
        trim: true,
    },
    // Ali je izbira obvezna
    required: {
        type: Boolean,
        default: false,
    },
    // Tip izbire: single = radio button, multiple = checkbox
    selectionType: {
        type: String,
        enum: ["single", "multiple"],
        default: "single",
    },
    // Za multiple: max število izbire (0 = neomejeno)
    maxSelections: {
        type: Number,
        default: 0,
        min: 0,
    },
    // Ali se ta skupina aplicira na vse artikle ali specifične
    // Če je globalApply = true, se aplicira na vse (npr. "Cook Temperature" za vse steake)
    globalApply: {
        type: Boolean,
        default: false,
    },
    // Priority za sortiranje v UI
    sortOrder: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
    // Posamezne opcije/modifikatorji
    modifiers: [{
        name: {
            type: String,
            required: true,
            trim: true,
        },
        // Cena dopolnila (pozitivna za "Extra Cheese +2€", negativna za "No Onions -0.5€")
        priceAdjustment: {
            type: Number,
            default: 0,
        },
        // Ali ta opcija spremeni ceno artikla (ne samo dopolnilo)
        // npr. "Large" spremeni ceno iz 10€ na 14€ namesto +4€
        priceOverride: {
            type: Number,
            default: null, // null = ne override, uporabi priceAdjustment
        },
        // Ali je ta opcija privzeto izbrana
        isDefault: {
            type: Boolean,
            default: false,
        },
        // Ali je ta opcija na voljo
        isAvailable: {
            type: Boolean,
            default: true,
        },
        // Za kuhanje — prioriteta (npr. "Well Done" traja dlje)
        prepTimeAdjustment: {
            type: Number, // v minutah
            default: 0,
        },
        // Sort
        sortOrder: {
            type: Number,
            default: 0,
        },
    }],
}, { timestamps: true });

modifierGroupSchema.index({ globalApply: 1, isActive: 1 });
modifierGroupSchema.index({ name: 1 });

const ModifierGroup = mongoose.models.ModifierGroup || mongoose.model("ModifierGroup", modifierGroupSchema);
module.exports = ModifierGroup;
