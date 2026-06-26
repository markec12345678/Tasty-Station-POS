const mongoose = require("mongoose");

/**
 * Outlet — posamezna lokacija restavracije v verigi.
 *
 * Uporablja se za multi-outlet sync: veriga restavracij lahko upravlja
 * več lokacij z ločenimi mizami, inventarjem in osebjem, ampak s skupnim menijem,
 * strankami in centralnim admin panelom.
 *
 * Primer:
 *   - "Tasty Station Ljubljana Center" (outletId na vsehOrder/Table/Inventory)
 *   - "Tasty Station Maribor" (ločen outletId)
 *   - "Tasty Station Bled" (ločen outletId)
 */
const outletSchema = new mongoose.Schema({
    name: {
        type: String,
        required: [true, "Outlet name is required"],
        trim: true,
    },
    code: {
        type: String,
        required: [true, "Outlet code is required"],
        unique: true,
        uppercase: true,
        trim: true,
        // npr. "TS-LJU", "TS-MB", "TS-BLD"
    },
    description: {
        type: String,
        trim: true,
    },
    // Kontakt
    address: {
        street: { type: String, trim: true },
        city: { type: String, trim: true },
        zip: { type: String, trim: true },
        country: { type: String, default: "Slovenia", trim: true },
    },
    phone: { type: String, trim: true },
    email: { type: String, trim: true, lowercase: true },
    // Odpiralni čas
    openingHours: {
        monday: { open: String, close: String, closed: { type: Boolean, default: false } },
        tuesday: { open: String, close: String, closed: { type: Boolean, default: false } },
        wednesday: { open: String, close: String, closed: { type: Boolean, default: false } },
        thursday: { open: String, close: String, closed: { type: Boolean, default: false } },
        friday: { open: String, close: String, closed: { type: Boolean, default: false } },
        saturday: { open: String, close: String, closed: { type: Boolean, default: false } },
        sunday: { open: String, close: String, closed: { type: Boolean, default: true } },
    },
    timezone: {
        type: String,
        default: "Europe/Ljubljana",
    },
    // Valuta specifična za outlet (override global CurrencySettings)
    currencyCode: {
        type: String,
        default: null, // null = uporabi global settings
        uppercase: true,
    },
    // Davčna številka (za Slovenijo: davčna številka zavezanca)
    taxNumber: {
        type: String,
        trim: true,
    },
    // Ali je outlet aktiven
    isActive: {
        type: Boolean,
        default: true,
    },
    // Ali je to glavni (HQ) outlet — samo en je lahko primary
    isPrimary: {
        type: Boolean,
        default: false,
    },
    // Geolokacija za zemljevid
    location: {
        lat: { type: Number, default: null },
        lng: { type: Number, default: null },
    },
    // Spremljanje
    manager: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
    stats: {
        totalTables: { type: Number, default: 0 },
        totalStaff: { type: Number, default: 0 },
        totalRevenue: { type: Number, default: 0 },
        totalOrders: { type: Number, default: 0 },
    },
}, { timestamps: true });

// Indexi
outletSchema.index({ code: 1 }, { unique: true });
outletSchema.index({ isActive: 1 });
outletSchema.index({ isPrimary: 1 });

// Static: pridobi primarni outlet
outletSchema.statics.getPrimary = async function() {
    return await this.findOne({ isPrimary: true, isActive: true });
};

// Static: pridobi aktivne outlete z stats
outletSchema.statics.getActiveWithStats = async function() {
    return await this.find({ isActive: true })
        .populate("manager", "name email")
        .sort({ isPrimary: -1, name: 1 })
        .lean();
};

const Outlet = mongoose.models.Outlet || mongoose.model("Outlet", outletSchema);
module.exports = Outlet;
