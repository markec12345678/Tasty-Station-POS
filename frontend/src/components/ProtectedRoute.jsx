import React from 'react';
import { Navigate } from 'react-router-dom';
import { can } from '@/utils/rbac';
import { useAuthStore } from '@/store/useAuthStore';

/**
 * ProtectedRoute — route guard s per-route RBAC.
 *
 * Prejšnje stanje: admin pod-rute v App.jsx so bile zaščitene samo na
 * layout levelu (admin ALI manager). Manager je tako lahko dosegel
 * /admin/backup (admin-only), /admin/audit (admin-only), /admin/staff
 * (admin-only) itd. — sidebar filter je skril povezavo, a sama ruta
 * ni bila zaščitena client-side.
 *
 * Sedaj lahko vsako ruto ovijemo s permission ključem:
 *   <Route path="/admin/backup" element={
 *     <ProtectedRoute permission="backup:download">
 *       <BackupRestore />
 *     </ProtectedRoute>
 *   } />
 *
 * Če uporabnik nima pravice, ga preusmerimo na /admin (admin dashboard),
 * kjer vidi samo tisto, kar sme. Admin (role === "admin") ima vedno dostop.
 */
const ProtectedRoute = ({ permission, children, fallback = "/admin" }) => {
    const { authUser } = useAuthStore();

    // Če ni authUser ali nima pravice → preusmeri.
    // (AdminLayout že preverja admin/manager na layout levelu, zato tukaj
    //  obravnavamo samo per-route permission.)
    if (!authUser) {
        return <Navigate to="/login" replace />;
    }
    if (!permission || can(authUser.role, permission)) {
        return children;
    }
    // Ni pravice — preusmeri na fallback (privzeto admin dashboard).
    return <Navigate to={fallback} replace />;
};

export default ProtectedRoute;
