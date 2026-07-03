const mongoose = require("mongoose");

/**
 * Recipe (Bill of Materials) — povezuje MenuItem z Inventory postavkami.
 *
 * Prejšnje stanje: inventoryForecast.controller je povezavo med menijem in
 * inventarjem delal z naivnim tekstovnim ujemanjem (menuItem.name vsebuje
 * prvo besedo inventory.name ALI enaka kategorija). To je nedoločno in
 * neprecizno — napoved porabe je bila praktično neuporabna.
 *
 * Sedaj: Recipe model definira, koliko katere inventory postavke gre v
 * določen MenuItem (npr. "Cheeseburger" → 1x beef patty (200g), 1x bun,
 * 1x cheese slice, 10g lettuce). To omogoča:
 *   1. Pravo recipe costing (koliko stane izdelava jedi)
 *   2. Pravo inventory depletion ob vsakem naročilu
 *   3. Pravo AI forecasting — poraba inventarja se izračuna iz prodaje menija
 *      × količine v receptih, ne iz besednega ujemanja
 *
 * Reference: Toast POS "recipe costing", Apicbase F&B BOM, NetSuite BOM.
 */
const recipeSchema = new mongoose.Schema({
    // MenuItem, ki mu pripada ta recept
    menuItem: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "MenuItem",
        required: [true, "MenuItem is required"],
        unique: true, // en recept na menuItem
        index: true,
    },
    // Seznam sestavin (inventory postavk) s količinami
    ingredients: [{
        inventory: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "Inventory",
            required: true,
        },
        // Količina te sestavine za 1 porcijo tega menuItem-a
        // (npr. 0.2 kg beef-a za cheeseburger)
        quantity: {
            type: Number,
            required: true,
            min: 0,
        },
        // Enota (lahko override inventory.unit za fleksibilnost, npr. "g" namesto "kg")
        unit: {
            type: String,
            default: null, // null = uporabi inventory.unit
            trim: true,
        },
        // Ali je ta sestavina obvezna (default) ali opcijska (npr. dodaten sir)
        optional: {
            type: Boolean,
            default: false,
        },
        // Komentar za kuhinjo (npr. "narezan na tanke rezine")
        note: {
            type: String,
            trim: true,
            default: "",
        },
    }],
    // Celoten recept (navodila) — tekstovni opis postopka
    instructions: {
        type: String,
        trim: true,
        default: "",
    },
    // Pripravni čas v minutah
    prepTime: {
        type: Number,
        min: 0,
        default: 0,
    },
    // Skupna cena recepta (computed: vsota ingredient.quantity × inventory.costPerUnit)
    // Ažurira se ob spremembi recepta ali cene inventarja (lahko tudi pre-aggregatano)
    computedCost: {
        type: Number,
        min: 0,
        default: 0,
    },
    // Aktivna različica (lahko imamo več verzij recepta za A/B testiranje)
    isActive: {
        type: Boolean,
        default: true,
    },
}, { timestamps: true });

// Index za hitro iskanje po inventory postavki (katere meniji uporabljajo X)
recipeSchema.index({ "ingredients.inventory": 1 });

/**
 * Preračuna in posodobi computedCost na podlagi trenutnih cen inventarja.
 * Pokliče se po vsaki spremembi recepta ali cene inventarja.
 */
recipeSchema.methods.recomputeCost = async function() {
    let total = 0;
    const Inventory = mongoose.model("Inventory");
    for (const ing of this.ingredients) {
        const inv = await Inventory.findById(ing.inventory).select("costPerUnit unit");
        if (inv && inv.costPerUnit != null) {
            total += ing.quantity * inv.costPerUnit;
        }
    }
    this.computedCost = Math.round(total * 100) / 100;
    return this.computedCost;
};

/**
 * Vrne pričakovan porabo inventarja za toliko porcij tega menija.
 * Uporablja se v inventoryForecast.controller za pravo napoved porabe.
 *
 * @param {Number} portions — število porcij
 * @returns {Array} [{ inventory, inventoryName, totalNeeded, unit, costPerUnit }]
 */
recipeSchema.methods.getConsumptionForPortions = async function(portions) {
    if (!portions || portions <= 0) return [];
    const Inventory = mongoose.model("Inventory");
    const result = [];
    for (const ing of this.ingredients) {
        if (ing.optional) continue; // opcijske sestavine ne štejejo v napoved
        const inv = await Inventory.findById(ing.inventory).select("name unit costPerUnit category quantity reorderLevel supplier");
        if (inv) {
            result.push({
                inventory: inv._id,
                inventoryName: inv.name,
                category: inv.category,
                unit: ing.unit || inv.unit,
                quantityNeeded: ing.quantity * portions,
                currentStock: inv.quantity,
                reorderLevel: inv.reorderLevel,
                costPerUnit: inv.costPerUnit,
                supplier: inv.supplier,
                totalCost: Math.round((ing.quantity * portions * (inv.costPerUnit || 0)) * 100) / 100,
            });
        }
    }
    return result;
};

const Recipe = mongoose.models.Recipe || mongoose.model("Recipe", recipeSchema);
module.exports = Recipe;
