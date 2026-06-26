const mongoose = require("mongoose");

/**
 * FiscalInvoice — davčno potrdilo (Slovenija: FURS).
 *
 * Slovenija zahteva, da vsak izdan račun vsebuje:
 *   - Zaporedno številko računa (invoiceNumber)
 *   - Davčno številko zavezanca (taxNumber / ZOI)
 *   - Zaščitno oznako izdajatelja računa (ZOI — Zaščitna Oznaka Izdajatelja)
 *   - EOR — Enkratna Identifikacijska Oznaka Računa (od FURS)
 *   - Datum in čas izdaje
 *   - Skupni znesek z DDV
 *
 * Postopek:
 *   1. Pred izdajo računa se generira ZOI (MD5 podpis z davčno številko, datumom, zaporedno številko, zneskom in certifikatom)
 *   2. Račun se pošlje FURS preko SOAP API-ja
 *   3. FURS vrne EOR (enkratna identifikacijska oznaka)
 *   4. ZOI in EOR se shranita v FiscalInvoice in natisneta na račun
 *
 * Ta model shrani vse potrebne podatke za davčno predpisano hrambo (10 let).
 */
const fiscalInvoiceSchema = new mongoose.Schema({
    // Povezava z Order-om
    order: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Order",
        required: true,
        index: true,
    },
    orderId: {  // snapshot za primer če se order izbriše
        type: String,
        required: true,
    },
    outlet: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Outlet",
        default: null,
    },
    // Zaporedna številka računa (posamezen outlet ima svoje zaporedje)
    invoiceNumber: {
        type: String,
        required: true,
        // format: "TS-LJU-2025-000123" (outletCode-year-sequence)
    },
    businessUnit: {
        type: String,
        default: "1",  // številka poslovnega prostora (FURS)
    },
    cashRegister: {
        type: String,
        default: "1",  // številka elektronske naprave (FURS)
    },
    // Davčna številka zavezanca (iz Outlet.taxNumber)
    taxNumber: {
        type: String,
        required: true,
    },
    // ZOI — Zaščitna Oznaka Izdajatelja računa (32-char hex MD5)
    zoi: {
        type: String,
        default: null,
        // generira se pred pošiljanjem FURS
    },
    // EOR — Enkratna Identifikacijska Oznaka Računa (UUID od FURS)
    eor: {
        type: String,
        default: null,
        // pridobi se od FURS po uspešni potrditvi
    },
    // QR koda za preverjanje računa (FURS zahteva na računu od 2023)
    fiscalQR: {
        type: String,
        default: null,  // base64 ali URL za prikaz na računu
    },
    // Status potrjevanja
    status: {
        type: String,
        enum: ["pending", "confirmed", "failed", "cancelled"],
        default: "pending",
    },
    // Datum in čas izdaje računa (FURS zahteva točne microsecond)
    issueDateTime: {
        type: Date,
        default: Date.now,
    },
    // Zneski
    totals: {
        subtotal: { type: Number, required: true },
        taxAmount: { type: Number, required: true },
        discount: { type: Number, default: 0 },
        total: { type: Number, required: true },
    },
    // DDV postavke po stopnjah (npr. 22%, 9.5%, 5%)
    taxBreakdown: [{
        rate: { type: Number, required: true },       // npr. 22
        base: { type: Number, required: true },       // osnova (znesek brez DDV)
        tax: { type: Number, required: true },        // znesek DDV
        gross: { type: Number, required: true },      // znesek z DDV
    }],
    // Placilo
    payment: {
        method: { type: String, enum: ["cash", "card", "other"], default: "cash" },
        amount: { type: Number, required: true },
    },
    // Stranka
    customer: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "Client",
        default: null,
    },
    customerName: { type: String, default: "Potrošnik" },
    customerTaxNumber: { type: String, default: null },  // če stranka zahteva račun na davčno številko
    // Napake pri potrjevanju (če je status failed)
    error: {
        code: { type: String, default: null },
        message: { type: String, default: null },
        timestamp: { type: Date, default: null },
    },
    // Število poskusov potrjevanja
    attempts: {
        type: Number,
        default: 0,
    },
    // Audit
    issuedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,
    },
}, {
    timestamps: true,
});

// Indexi
fiscalInvoiceSchema.index({ invoiceNumber: 1, outlet: 1 }, { unique: true });
fiscalInvoiceSchema.index({ zoi: 1 });
fiscalInvoiceSchema.index({ eor: 1 });
fiscalInvoiceSchema.index({ status: 1, issueDateTime: -1 });
fiscalInvoiceSchema.index({ taxNumber: 1, issueDateTime: -1 });

const FiscalInvoice = mongoose.models.FiscalInvoice || mongoose.model("FiscalInvoice", fiscalInvoiceSchema);
module.exports = FiscalInvoice;
