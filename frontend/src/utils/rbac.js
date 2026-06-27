/**
 * Frontend RBAC — kontrola dostopa na strani odjemalca.
 *
 * Uporaba:
 *   import { can, canAny, ROLE_PERMISSIONS } from '@/utils/rbac';
 *
 *   if (can(user.role, 'orders:payment')) { ... }
 *
 *   <ProtectedRoute permission="orders:create">
 *     <OrderPage />
 *   </ProtectedRoute>
 */

// Permission definitions (mirror backend)
export const PERMISSIONS = {
    "orders:create": ["admin", "manager", "cashier", "waiter"],
    "orders:read": ["admin", "manager", "cashier", "waiter", "kitchen"],
    "orders:update": ["admin", "manager", "cashier", "waiter"],
    "orders:delete": ["admin", "manager"],
    "orders:payment": ["admin", "manager", "cashier"],
    "orders:refund": ["admin", "manager"],
    "orders:send-course": ["admin", "manager", "cashier", "waiter"],
    "menu:create": ["admin", "manager"],
    "menu:update": ["admin", "manager"],
    "menu:delete": ["admin", "manager"],
    "menu:read": ["admin", "manager", "cashier", "waiter", "kitchen", "client"],
    "modifiers:create": ["admin", "manager"],
    "modifiers:update": ["admin", "manager"],
    "modifiers:delete": ["admin", "manager"],
    "modifiers:read": ["admin", "manager", "cashier", "waiter", "client"],
    "tables:create": ["admin", "manager"],
    "tables:update": ["admin", "manager"],
    "tables:delete": ["admin"],
    "tables:read": ["admin", "manager", "cashier", "waiter", "kitchen"],
    "tables:reserve": ["admin", "manager", "cashier", "waiter"],
    "inventory:create": ["admin", "manager"],
    "inventory:update": ["admin", "manager"],
    "inventory:delete": ["admin", "manager"],
    "inventory:read": ["admin", "manager", "cashier"],
    "users:create": ["admin"],
    "users:update": ["admin"],
    "users:delete": ["admin"],
    "users:read": ["admin", "manager"],
    "clients:read": ["admin", "manager", "cashier", "waiter"],
    "loyalty:read": ["admin", "manager", "cashier", "waiter", "client"],
    "loyalty:redeem": ["admin", "manager", "cashier", "waiter", "client"],
    "loyalty:adjust": ["admin", "manager"],
    "loyalty:manage": ["admin", "manager"],
    "currency:read": ["admin", "manager", "cashier", "waiter", "client"],
    "currency:update": ["admin"],
    "tax:read": ["admin", "manager", "cashier"],
    "reports:read": ["admin", "manager"],
    "reports:export": ["admin", "manager"],
    "backup:download": ["admin"],
    "backup:restore": ["admin"],
    "audit:read": ["admin"],
    "outlets:read": ["admin", "manager"],
    "fiscal:read": ["admin", "manager"],
    "email:send": ["admin"],
    "dashboard:read": ["admin", "manager", "cashier"],
    "kitchen:read": ["admin", "manager", "cashier", "waiter", "kitchen"],
    "kitchen:update": ["admin", "manager", "cashier", "waiter", "kitchen"],
};

export const ROLE_LABELS = {
    admin: "Administrator",
    manager: "Manager",
    cashier: "Cashier",
    waiter: "Waiter",
    kitchen: "Kitchen Staff",
    client: "Client",
};

export const ROLE_COLORS = {
    admin: "bg-red-500/10 text-red-700 border-red-500/30",
    manager: "bg-purple-500/10 text-purple-700 border-purple-500/30",
    cashier: "bg-blue-500/10 text-blue-700 border-blue-500/30",
    waiter: "bg-emerald-500/10 text-emerald-700 border-emerald-500/30",
    kitchen: "bg-amber-500/10 text-amber-700 border-amber-500/30",
    client: "bg-gray-500/10 text-gray-700 border-gray-500/30",
};

export const can = (role, permission) => {
    if (!role || !permission) return false;
    if (role === "admin") return true;
    const allowed = PERMISSIONS[permission];
    return allowed ? allowed.includes(role) : false;
};

export const canAny = (role, permissions) => {
    return permissions.some(p => can(role, p));
};

export const getPermissionsForRole = (role) => {
    if (role === "admin") return Object.keys(PERMISSIONS);
    return Object.entries(PERMISSIONS)
        .filter(([_, roles]) => roles.includes(role))
        .map(([perm]) => perm);
};

// Vrne menu item-e, ki so vidni za določeno vlogo
export const filterMenuByRole = (menuItems, role) => {
    return menuItems.filter(item => {
        if (!item.permission) return true;
        return can(role, item.permission);
    });
};
