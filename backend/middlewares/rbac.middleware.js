/**
 * RBAC (Role-Based Access Control) — granularna kontrola dostopa.
 *
 * 6 vlog: admin, manager, cashier, waiter, kitchen, client
 *
 * Permission matrix:
 *
 * admin:    VSE (full access)
 * manager:  Vse razen backup/restore, outlet management, email config
 * cashier:  orders, payments, menu view, tables, clients, reports view
 * waiter:   orders (own), tables (assigned), menu view, QR orders
 * kitchen:  kitchen orders (view + status update only)
 * client:   public menu, own orders, loyalty
 */

// Permission definitions
const PERMISSIONS = {
    // Orders
    "orders:create": ["admin", "manager", "cashier", "waiter"],
    "orders:read": ["admin", "manager", "cashier", "waiter", "kitchen"],
    "orders:update": ["admin", "manager", "cashier", "waiter"],
    "orders:delete": ["admin", "manager"],
    "orders:payment": ["admin", "manager", "cashier"],
    "orders:refund": ["admin", "manager"],
    "orders:send-course": ["admin", "manager", "cashier", "waiter"],

    // Menu
    "menu:create": ["admin", "manager"],
    "menu:update": ["admin", "manager"],
    "menu:delete": ["admin", "manager"],
    "menu:read": ["admin", "manager", "cashier", "waiter", "kitchen", "client"],

    // Modifiers
    "modifiers:create": ["admin", "manager"],
    "modifiers:update": ["admin", "manager"],
    "modifiers:delete": ["admin", "manager"],
    "modifiers:read": ["admin", "manager", "cashier", "waiter", "client"],

    // Tables
    "tables:create": ["admin", "manager"],
    "tables:update": ["admin", "manager"],
    "tables:delete": ["admin"],
    "tables:read": ["admin", "manager", "cashier", "waiter", "kitchen"],
    "tables:reserve": ["admin", "manager", "cashier", "waiter"],
    "tables:position": ["admin", "manager"],

    // Inventory
    "inventory:create": ["admin", "manager"],
    "inventory:update": ["admin", "manager"],
    "inventory:delete": ["admin", "manager"],
    "inventory:read": ["admin", "manager", "cashier"],

    // Users / Staff
    "users:create": ["admin"],
    "users:update": ["admin"],
    "users:delete": ["admin"],
    "users:read": ["admin", "manager"],

    // Clients
    "clients:read": ["admin", "manager", "cashier", "waiter"],
    "clients:update": ["admin", "manager", "cashier"],

    // Loyalty
    "loyalty:read": ["admin", "manager", "cashier", "waiter", "client"],
    "loyalty:redeem": ["admin", "manager", "cashier", "waiter", "client"],
    "loyalty:adjust": ["admin", "manager"],
    "loyalty:manage": ["admin", "manager"],

    // Currency
    "currency:read": ["admin", "manager", "cashier", "waiter", "client"],
    "currency:update": ["admin"],

    // Tax
    "tax:read": ["admin", "manager", "cashier"],
    "tax:create": ["admin"],
    "tax:update": ["admin"],
    "tax:delete": ["admin"],

    // Reports
    "reports:read": ["admin", "manager"],
    "reports:export": ["admin", "manager"],

    // Backup
    "backup:download": ["admin"],
    "backup:restore": ["admin"],
    "backup:stats": ["admin"],

    // Audit
    "audit:read": ["admin"],
    "audit:delete": ["admin"],

    // Outlets
    "outlets:create": ["admin"],
    "outlets:update": ["admin"],
    "outlets:delete": ["admin"],
    "outlets:read": ["admin", "manager"],

    // Fiscal (FURS)
    "fiscal:read": ["admin", "manager"],
    "fiscal:retry": ["admin", "manager"],

    // Email
    "email:send": ["admin"],
    "email:status": ["admin", "manager"],

    // Dashboard
    "dashboard:read": ["admin", "manager", "cashier"],

    // Kitchen
    "kitchen:read": ["admin", "manager", "cashier", "waiter", "kitchen"],
    "kitchen:update": ["admin", "manager", "cashier", "waiter", "kitchen"],
};

/**
 * Preveri ali ima uporabnik določeno pravico.
 * @param {String} role — vloga uporabnika
 * @param {String} permission — ključ pravice (npr. "orders:payment")
 * @returns {Boolean}
 */
const hasPermission = (role, permission) => {
    if (!role || !permission) return false;
    // Admin ima vedno vse
    if (role === "admin") return true;
    const allowedRoles = PERMISSIONS[permission];
    if (!allowedRoles) return false;
    return allowedRoles.includes(role);
};

/**
 * Middleware za Express — preveri specifično pravico.
 *
 * Uporaba:
 *   router.post("/", protectedRoute, requirePermission("orders:create"), createOrder);
 *
 * @param {String} permission — ključ pravice
 */
const requirePermission = (permission) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized — authentication required"
            });
        }

        if (!hasPermission(req.user.role, permission)) {
            return res.status(403).json({
                success: false,
                message: `Forbidden — role "${req.user.role}" cannot perform "${permission}"`,
                requiredPermission: permission,
                userRole: req.user.role,
            });
        }

        next();
    };
};

/**
 * Middleware — preveri list pravic (katerakoli zadostuje).
 * @param {String[]} permissions — lista pravic (OR logic)
 */
const requireAnyPermission = (permissions) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({
                success: false,
                message: "Unauthorized — authentication required"
            });
        }

        const hasAny = permissions.some(p => hasPermission(req.user.role, p));
        if (!hasAny) {
            return res.status(403).json({
                success: false,
                message: `Forbidden — requires any of: ${permissions.join(", ")}`,
                userRole: req.user.role,
            });
        }

        next();
    };
};

/**
 * Vrne vse pravice za določeno vlogo (za frontend).
 */
const getPermissionsForRole = (role) => {
    if (role === "admin") {
        return Object.keys(PERMISSIONS);
    }
    return Object.entries(PERMISSIONS)
        .filter(([_, roles]) => roles.includes(role))
        .map(([perm, _]) => perm);
};

module.exports = {
    PERMISSIONS,
    hasPermission,
    requirePermission,
    requireAnyPermission,
    getPermissionsForRole,
};
