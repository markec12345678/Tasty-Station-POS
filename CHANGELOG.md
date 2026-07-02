# Changelog

Vse pomembne spremembe v Tasty Station POS projektu.

Format temelji na [Keep a Changelog](https://keepachangelog.com/slo/1.1.0/),
in projekt upošteva [Semantic Versioning](https://semver.org/lang/sl/).

---

## [1.1.0] — 2025-07-02 — Security & Quality Audit

Celovit varnostni, finančni in kvalitetni audit. 55+ datotek popravljeno,
130/130 testov zelenih, 0 lint napak.

### 🐛 Critical Bug Fixes (backend)

- **Missing npm dependencies** (`axios`, `date-fns`) — server could not boot.
  `pushService.js`, `exchangeRate.controller.js`, `zreport.router.js` required
  modules not in `package.json`.
- **Unauthenticated routers** — `inventory.router.js` and `chat.router.js` were
  fully public (no auth). Now require `protectedRoute` + per-route RBAC.
- **seed.js bypassed bcrypt** — `User.insertMany` skipped `pre("save")` hook;
  seed users had plaintext passwords and couldn't log in. Fixed to `User.create()`.
- **Loyalty `nextThreshold` ReferenceError** — shorthand referenced undefined
  variable (`nextTierThreshold` was defined). Would crash `/api/loyalty/:clientId`.

### 🔒 Security

- **PIN hashing** — PINs were stored plaintext. Added bcrypt hashing in
  `pre("save")` hook + `comparePin()` method. `pinLogin` now uses secure
  comparison (not direct `findOne({pin})`).
- **Password hash leak** — `register`/`login`/`pinLogin` responses returned
  full user document including bcrypt hash. Now strips `password` + `pin`.
- **Bearer token auth** — backend now accepts `Authorization: Bearer` as
  fallback when no cookie (React Native doesn't persist cookies). Mobile
  app stores real JWT token (was fallback to literal `"session"`).
- **Committed `.env` untracked** — `frontend/.env` was committed to git.
  Ran `git rm --cached`, updated `.gitignore` with `.env` rules.
- **Per-route RBAC for admin** — 18 admin sub-routes were protected only at
  layout level (admin OR manager). Manager could reach `/admin/backup`
  (admin-only). Added `ProtectedRoute` component with per-route permissions.
- **`addPayment` race condition** — read-modify-write without locking. Two
  concurrent cashiers could double-pay. Fixed with transaction + Mongoose
  optimistic locking (`__v` versioning) + 409 Conflict on `VersionError`.

### 💰 Financial Integrity

- **Tax application in `createOrder`** — orders had no tax breakdown; reports
  and FURS had to back-calculate with hardcoded 22%. Added `taxRate`,
  `taxAmount`, `subtotal` fields to Order model. `createOrder` now computes
  based on `CurrencySettings` (standard rate + taxInclusive flag).
- **Dynamic DDV in FURS** — `buildSOAPEnvelope` had hardcoded `<TaxRate>22.00</TaxRate>`.
  Now uses `order.taxRate` (or `CurrencySettings.taxRates.standard` fallback).
  Compatible with reduced rates (9.5%, 5%).
- **Dynamic tax in z-report** — was hardcoded `const taxRate = 22` for all
  orders. Now uses `order.taxRate` with `CurrencySettings` fallback.
- **Multi-outlet revenue** — `outlet.controller.js` aggregated by `outletId`
  but Order model had no `outletId` field → always returned 0. Added field
  + compound index. `createOrder` populates from `req.user.outletId`.
- **Modifiers in `createOrder`** — `item.modifiers` array was ignored in
  price calculation. Now applies `priceAdjustment`/`priceOverride`, stores
  `unitPrice`/`lineTotal` with modifiers.

### 🔄 Dead Code Activation

- **Audit log** — `logAction()` helper existed but no controller called it
  (0 actions logged). Activated across 5 controllers: 19 action types
  (order_create/status_update/cancel/payment, register/login/login_failed,
  user_create/update/delete, loyalty_redeem/adjust/settings,
  currency_update/preset_apply, backup_download/restore, inventory_create/update/delete).
- **Loyalty + FURS on completion** — `awardPointsForOrder` and `confirmInvoice`
  were dead code. Added `onOrderCompleted()` helper (idempotent) + called in
  `updateOrderStatus` (Completed) and `addPayment` (balanceDue === 0).
- **Low stock notifications** — `notifyLowStock` was dead code in frontend.
  Added `checkLowStockAndNotify()` in backend inventory controller (push
  notification to admin/manager when `quantity ≤ reorderLevel`).
- **Frontend notification helpers** — `notifyOrderReady`, `notifyQROrder`,
  `notifyPayment` were exported but never called. Wired into
  `useOrderStore.setupSocketListeners`.

### 📱 Mobile

- **Socket.io real-time** — KitchenScreen used 10s HTTP polling (README lied
  about "real-time"). Added `socket.io-client` dependency, `socket.js`
  config, real-time listeners (`newOrder`, `qrOrderPlaced`, `orderStatusUpdate`).
- **PIN login** — documented in backend but not implemented in mobile. Added
  `pinLogin()` in client.js, `loginWithPin()` in authStore, PIN UI in
  LoginScreen (4-digit numpad, toggle with email/password).
- **`app.json` projectId** — was empty (EAS builds fail). Added UUID + removed
  wrong `expo-router` plugin + `experiments.typedRoutes`.
- **Configurable API URL** — was hardcoded `localhost:3000`. Added
  `EXPO_PUBLIC_API_URL` env var support via `src/api/config.js`.
- **Real token storage** — was `res.data.token || "session"` (literal fallback).
  Now stores real JWT returned by backend.
- **Demo credentials removed** — LoginScreen had pre-filled
  `admin@pos.com`/`password123` (seed admin). Security risk; removed.

### 🎨 Frontend

- **AdminSidebar empty** — destructured only `{ logout }`, `authUser` was
  undefined → `can(undefined, …)` returned false for all items → sidebar
  showed 0 menu items. Fixed destructure.
- **Unified backend hostname** — 3 different hostnames across `axiosInstace.js`,
  `socket.config.js`, `vercel.json`. Created `src/config/api.config.js`
  (single source of truth). All consumers import from it.
- **axios interceptors** — no timeout (hung requests could freeze UI), no
  401 handler. Added 30s timeout + 401 → redirect to `/login`.
- **`useChatStore` hardcoded localhost** — `http://localhost:3000/api/chat/message`
  failed in production. Now uses central `axiosInstance`.
- **Hardcoded currency/tax** — `DashboardHome` showed `Rs` (Pakistani Rupee),
  `OrderSummarySidebar` used `subtotal * 0.1` (hardcoded 10% GST). Both now
  use `useCurrencyStore.format()` + `useTaxStore.getTaxRate()`.
- **POS cart modifier support** — `useOrderStore` keyed cart only by
  `menuItem._id`; couldn't sell same item with different modifiers. Added
  composite `cartKey` (`menuItem._id__modifierNames`) + `unitPrice` calc.
- **Socket listeners** — `useOrderStore` didn't listen to `qrOrderPlaced`
  (cashier missed QR orders until manual refresh) or `paymentUpdate`
  (stats didn't refresh on payment). Both added.
- **`ProtectedRoute` component** — new, for per-route RBAC (see Security).
- **PWA consistency** — README claimed "PWA Capability" with "Service Workers"
  but `vite-plugin-pwa` was commented out and `vercel.json` cached `/sw.js`
  that was never generated. Cleaned up: vite.config comment, vercel.json
  (removed sw.js header, unified backend URL), README (renamed section to
  "Offline Resilience (IndexedDB Queue)").
- **i18n mock in tests** — `useTranslation()` failed in test env (not mocked).
  Login tests searched for English strings. Added global mock (`t: (key) => key`),
  updated assertions to i18n keys.
- **Bundle optimization** — single 1.36 MB chunk. Added `manualChunks`
  (Function format for rolldown-vite): 6 vendor chunks (react-vendor,
  ui-vendor, charts-vendor, data-vendor, i18n-vendor) + index 270 KB.
  Browser caches vendor chunks independently; `charts-vendor` (547 KB)
  loads only when admin opens dashboard.

### 🧹 Code Quality

- **Backend ESLint** — 15 errors → 0 (removed unused imports/vars across
  8 files: `currency`, `exchangeRate`, `inventoryForecast`, `loyalty`,
  `order`, `report`, `dev`, `email.router`, `user.router`).
- **Frontend ESLint** — 40 errors + 6 warnings → 0 (cleaned 15+ files:
  PinLogin, Navbar, AuditLog, CurrencySettings, ForecastPage,
  LoyaltyManagement, OutletManagement, QRCodeGenerator, ReportsDashboard,
  Login, OrderTracking, FloorPlanEditor, KitchenDashboard, WaiterTerminal,
  LiveDashboard + stores).
- **ESLint config** — added `caughtErrorsIgnorePattern: '^_'` (standard
  convention for unused catch errors).
- **Dead code deleted** — `backend/check_models.js`, `backend/verify_order.js`,
  `backend/test-gemini.js` (debug scripts), `backend/routers/redis.test.router.js`
  (debug endpoint exposing Redis status publicly — unmounted from index.js),
  `frontend/src/pages/Admin/pages/AdminHome.jsx` (placeholder, not routed).
- **`main.jsx` unused imports** — `Navbar` and `Toaster` imported but never
  rendered (App.jsx renders Toaster, Dashboard.jsx renders Navbar).
- **`useReportStore`/`useReportsStore` deduplication** — two parallel stores
  for reports domain (both called `/reports/*`). Unified into `useReportStore`;
  `useReportsStore` is now a re-export wrapper (backward-compat).

### 🔧 CI/CD

- **Quality gate enabled** — `continue-on-error: true` on backend tests,
  frontend lint, frontend tests made CI a smoke test (passing regardless of
  result). Removed; CI is now a real quality gate (lint + tests must pass).

### 📚 Documentation

- **README** — PWA section renamed + clarified; roadmap updated (20/21 done);
  architecture diagram "React PWA" → "React Web App".
- **`.env.example`** — added missing `GEMINI_API_KEY` (inventory forecast)
  and `VITE_API_BASE_URL` (frontend backend URL override).
- **`mobile/.env.example`** — new, documents `EXPO_PUBLIC_API_URL`.

### 🧪 Tests

- **Backend**: 85/85 PASS (0 regressions)
- **Frontend**: 41/45 → **45/45 PASS** (fixed Login.test.jsx i18n,
  OrderSummarySidebar.test.jsx store mocks)

---

## [1.0.0] — 2025-06-15 — Initial Release

Enterprise restaurant POS with KDS, QR ordering, FURS fiscal, loyalty,
multi-outlet, AI inventory forecast, React Native mobile app.

See README.md for full feature list.
