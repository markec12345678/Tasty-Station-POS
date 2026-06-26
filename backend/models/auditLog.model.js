const mongoose = require("mongoose");

/**
 * AuditLog — sledi vsem pomembnim akcijam v sistemu.
 * Vsak zapis predstavlja eno akcijo (order create, status change, login, etc.)
 *
 * Uporablja se za:
 *   - Sledenje kdo je kaj naredil (admin akcije, financial spremembe)
 *   - Compliance in forenzika
 *   - Debugging problemov (kdo je spremenil status)
 *   - Security audit (failed logins, suspicious patterns)
 */
const auditLogSchema = new mongoose.Schema({
    // Kdo je izvedel akcijo
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: "User",
        default: null,    // null za sistem akcije
    },
    userEmail: { type: String, default: null },  // snapshot za primer če user izbriše
    userRole: { type: String, default: null },

    // Kaj je bilo narejeno
    action: {
        type: String,
        required: true,
        enum: [
            // Auth
            "login", "logout", "login_failed", "register",
            // Orders
            "order_create", "order_status_update", "order_payment", "order_cancel",
            // Menu
            "menu_create", "menu_update", "menu_delete",
            "category_create", "category_update", "category_delete",
            // Tables
            "table_create", "table_update", "table_delete",
            "table_reserve", "table_cancel_reservation",
            "table_position_update",
            // Loyalty
            "loyalty_redeem", "loyalty_adjust", "loyalty_settings_update",
            "reward_create", "reward_update", "reward_delete",
            // Backup
            "backup_download", "backup_restore",
            // Currency & Tax
            "currency_update", "currency_preset_apply",
            "tax_create", "tax_update", "tax_delete",
            // Users
            "user_create", "user_update", "user_delete",
            // System
            "system_error", "system_config_change",
        ],
    },
    // Na kateri entiteti (order, table, menu_item, ...)
    entity: {
        type: String,
        enum: ["order", "menu_item", "category", "table", "client", "user",
               "inventory", "tax", "discount", "reward", "loyalty", "currency",
               "backup", "system", "auth"],
    },
    entityId: {
        type: mongoose.Schema.Types.ObjectId,
        default: null,
    },
    // Opis akcije (berljiv tekst)
    description: { type: String, required: true },
    // Spremembe (before/after) — JSON diff
    changes: {
        type: mongoose.Schema.Types.Mixed,
        default: null,
    },
    // IP naslov uporabnika
    ipAddress: { type: String, default: null },
    // User-Agent (browser info)
    userAgent: { type: String, default: null },
    // Status akcije
    status: {
        type: String,
        enum: ["success", "failed", "warning"],
        default: "success",
    },
    // Error message če je failed
    errorMessage: { type: String, default: null },
}, {
    timestamps: { createdAt: true, updatedAt: false }   // samo createdAt, ni updatedAt
});

// Indexi za hitro iskanje
auditLogSchema.index({ user: 1, createdAt: -1 });
auditLogSchema.index({ action: 1, createdAt: -1 });
auditLogSchema.index({ entity: 1, entityId: 1, createdAt: -1 });
auditLogSchema.index({ createdAt: -1 });

// Auto-expire po 365 dneh (configurable)
auditLogSchema.index({ createdAt: 1 }, { expireAfterSeconds: 365 * 24 * 60 * 60 });

const AuditLog = mongoose.models.AuditLog || mongoose.model("AuditLog", auditLogSchema);
module.exports = AuditLog;
