const AuditLog = require("../models/auditLog.model");

/**
 * AuditLog middleware — avtomatsko zapiše akcijo v audit log.
 *
 * Uporaba v controller-jih:
 *   await logAction(req, {
 *     action: "order_create",
 *     entity: "order",
 *     entityId: order._id,
 *     description: `Order ${order.orderId} created for ${order.clientName}`,
 *     changes: { before: null, after: order },
 *   });
 */
const logAction = async (req, opts) => {
    try {
        const {
            action,
            entity,
            entityId = null,
            description,
            changes = null,
            status = "success",
            errorMessage = null,
        } = opts;

        if (!action || !description) {
            console.warn("logAction: action and description are required");
            return null;
        }

        const entry = await AuditLog.create({
            user: req.user?._id || null,
            userEmail: req.user?.email || null,
            userRole: req.user?.role || null,
            action,
            entity,
            entityId,
            description,
            changes,
            ipAddress: req.ip || req.connection?.remoteAddress || null,
            userAgent: req.get("User-Agent") || null,
            status,
            errorMessage,
        });

        return entry;
    } catch (error) {
        console.error("AuditLog error (non-blocking):", error.message);
        // Ne vržemo napake — audit log ne sme blokirati glavnega flow-a
        return null;
    }
};

module.exports = { logAction };
