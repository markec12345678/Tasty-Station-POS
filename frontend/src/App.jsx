import React, { lazy, Suspense } from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
import { useAuthStore } from './store/useAuthStore'
import { useThemeStore } from './store/useThemeStore'
import { useOrderStore } from './store/useOrderStore'
import { connectSocket, disconnectSocket } from './config/socket.config'
import { Loader } from 'lucide-react'

// Layouts and Core Pages (Static)
import Login from './pages/Auth/Login'
import Signup from './pages/Auth/Signup'
import Dashboard from './pages/dashboard/Dashboard'
import AdminLayout from './pages/Admin/AdminLayout'
import DashboardHome from './pages/dashboard/page/DashboardHome'

// Dashboard Pages (Static for POS speed)
import OrderPage from './pages/dashboard/page/OrderPage'
import ManageTables from './pages/dashboard/page/ManageTables'
import Inventory from './pages/dashboard/page/Inventory'
import Dishes from './pages/dashboard/page/Dishes'
import Customer from './pages/dashboard/page/Customer'
import KitchenDashboard from './pages/dashboard/page/KitchenDashboard'
import WaiterTerminal from './pages/dashboard/page/WaiterTerminal'

// QR Ordering (public, no auth required)
import QROrderPage from './pages/QR/QROrderPage'
import OrderTracking from './pages/QR/OrderTracking'

// Admin Pages (Lazy Loaded)
const AdminDashboard = lazy(() => import('./pages/Admin/pages/AdminDashboard'));
const MenuManagement = lazy(() => import('./pages/Admin/pages/MenuManagement'));
const AddCategory = lazy(() => import('./pages/Admin/pages/AddCategory'));
const AddMenu = lazy(() => import('./pages/Admin/pages/AddMenu'));
const AdminTables = lazy(() => import('./pages/Admin/pages/AdminTables'));
const ManageInventory = lazy(() => import('./pages/Admin/pages/ManageInventory'));
const AdminReports = lazy(() => import('./pages/Admin/pages/AdminReports'));
const StaffManagement = lazy(() => import('./pages/Admin/pages/StaffManagement'));
const CustomerHistory = lazy(() => import('./pages/Admin/pages/CustomerHistory'));
const BackupRestore = lazy(() => import('./pages/Admin/pages/BackupRestore'));
const LoyaltyManagement = lazy(() => import('./pages/Admin/pages/LoyaltyManagement'));
const AuditLog = lazy(() => import('./pages/Admin/pages/AuditLog'));
const ForecastPage = lazy(() => import('./pages/Admin/pages/ForecastPage'));
const CurrencySettings = lazy(() => import('./pages/Admin/pages/CurrencySettings'));
const ReportsDashboard = lazy(() => import('./pages/Admin/pages/ReportsDashboard'));
const QRCodeGenerator = lazy(() => import('./pages/Admin/pages/QRCodeGenerator'));
const OutletManagement = lazy(() => import('./pages/Admin/pages/OutletManagement'));
const FiscalInvoices = lazy(() => import('./pages/Admin/pages/FiscalInvoices'));
const ModifierManagement = lazy(() => import('./pages/Admin/pages/ModifierManagement'));
const ZReportPage = lazy(() => import('./pages/Admin/pages/ZReportPage'));

import ChatWidget from './components/chat/ChatWidget';
import OfflineBanner from './components/OfflineBanner';
import ProtectedRoute from './components/ProtectedRoute';
import { Toaster } from 'sonner';
import { can } from './utils/rbac';

const PageLoader = () => (
  <div className="w-full h-[60vh] flex justify-center items-center">
    <Loader className="animate-spin size-10 text-cyan-500" />
  </div>
);

const App = () => {
  const { authUser, checkAuth, isCheckingAuth } = useAuthStore();
  const { theme } = useThemeStore();
  const { setupSocketListeners, cleanupSocketListeners } = useOrderStore();

  React.useEffect(() => {
    checkAuth();
  }, [checkAuth]);

  // Manage Socket.io connection based on auth state
  React.useEffect(() => {
    if (authUser) {
      connectSocket();
      setupSocketListeners();
    } else {
      cleanupSocketListeners();
      disconnectSocket();
    }

    return () => {
      cleanupSocketListeners();
      disconnectSocket();
    };
  }, [authUser, setupSocketListeners, cleanupSocketListeners]);

  React.useEffect(() => {
    const root = window.document.documentElement;
    root.classList.remove("light", "dark");

    if (theme === "system") {
      const systemTheme = window.matchMedia("(prefers-color-scheme: dark)").matches
        ? "dark"
        : "light";
      root.classList.add(systemTheme);
      return;
    }

    root.classList.add(theme);
  }, [theme]);

  // console.log(authUser)

  // console.log(authUser)

  if (isCheckingAuth) {
    return <div className='w-full h-screen flex justify-center items-center'><Loader className="animate-spin size-20 text-cyan-500" /></div>
  }
  return (
    <>
      <OfflineBanner />
      <Routes>

        <Route
          path="/login"
          element={!authUser ? <Login /> : <Navigate to={authUser.role === 'admin' ? "/admin" : "/"} />}
        />
        <Route
          path="/signup"
          element={!authUser ? <Signup /> : <Navigate to={authUser.role === 'admin' ? "/admin" : "/"} />}
        />

        {/* QR Ordering — public, no auth required */}
        <Route path="/qr/:tableId" element={<QROrderPage />} />
        <Route path="/track/:orderId" element={<OrderTracking />} />
        <Route path="/track" element={<OrderTracking />} />

        <Route path="/" element={authUser ? <Dashboard /> : <Navigate to="/login" />} >
          <Route index element={
            authUser?.role === 'admin' ? <Navigate to="/admin" /> : <Navigate to="dashboard" />
          } />
          <Route path="dashboard" element={can(authUser?.role, 'dashboard:read') ? <DashboardHome /> : <Navigate to="/" />} />
          <Route path="orders" element={can(authUser?.role, 'orders:create') ? <OrderPage /> : <Navigate to="/" />} />
          <Route path="tables" element={can(authUser?.role, 'tables:read') ? <ManageTables /> : <Navigate to="/" />} />
          <Route path="waiter" element={can(authUser?.role, 'orders:create') ? <WaiterTerminal /> : <Navigate to="/" />} />
          <Route path="inventory" element={can(authUser?.role, 'inventory:read') ? <Inventory /> : <Navigate to="/" />} />
          <Route path="dishes" element={can(authUser?.role, 'orders:read') ? <Dishes /> : <Navigate to="/" />} />
          <Route path="customers" element={can(authUser?.role, 'clients:read') ? <Customer /> : <Navigate to="/" />} />
          <Route path="kitchen" element={can(authUser?.role, 'kitchen:read') ? <KitchenDashboard /> : <Navigate to="/" />} />
        </Route>

        <Route path='/admin' element={authUser && (authUser.role === 'admin' || authUser.role === 'manager') ? <AdminLayout /> : <Navigate to={authUser ? "/" : "/login"} />} >
          <Route index element={
            <Suspense fallback={<PageLoader />}>
              <AdminDashboard />
            </Suspense>
          } />
          <Route path="/admin/menu" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="menu:read"><MenuManagement /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/add-category" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="menu:create"><AddCategory /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/add-menu" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="menu:create"><AddMenu /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/tables" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="tables:read"><AdminTables /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/inventory" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="inventory:read"><ManageInventory /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/reports" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="reports:read"><AdminReports /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/staff" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="users:read"><StaffManagement /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/customer-history" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="clients:read"><CustomerHistory /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/backup" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="backup:download"><BackupRestore /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/loyalty" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="loyalty:read"><LoyaltyManagement /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/audit" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="audit:read"><AuditLog /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/forecast" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="inventory:read"><ForecastPage /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/currency" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="currency:read"><CurrencySettings /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/reports-dashboard" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="reports:read"><ReportsDashboard /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/qr-codes" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="tables:read"><QRCodeGenerator /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/outlets" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="outlets:read"><OutletManagement /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/fiscal" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="fiscal:read"><FiscalInvoices /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/modifiers" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="modifiers:read"><ModifierManagement /></ProtectedRoute>
            </Suspense>
          } />
          <Route path="/admin/z-report" element={
            <Suspense fallback={<PageLoader />}>
              <ProtectedRoute permission="reports:read"><ZReportPage /></ProtectedRoute>
            </Suspense>
          } />
        </Route>

      </Routes>
      {authUser && <ChatWidget />}
      <Toaster position="top-right" richColors expand={false} />
    </>
  )
}

export default App