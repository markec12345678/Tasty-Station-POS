# Tasty Station POS — Project Summary

**Enterprise restaurant POS system with KDS, QR ordering, FURS fiscal, loyalty, multi-outlet, AI inventory forecast, and React Native mobile app.**

---

## 📊 Current State (July 2025)

| Metric | Value |
|---|---|
| **Version** | v1.7.0 |
| **Total tests** | 246 (172 backend + 74 frontend) ✅ |
| **ESLint** | 0 errors, 0 warnings (backend + frontend) ✅ |
| **npm audit** | 0 vulnerabilities (backend + frontend) ✅ |
| **Frontend build** | ✓ successful (6 vendor chunks + lazy admin) |
| **CI quality gate** | enabled (lint + tests must pass) |
| **Roadmap** | 23/24 done (only "Production deployment" open) |
| **QA grade** | 9.8/10 |

---

## 🏗️ Architecture

```
┌─────────────┐   ┌──────────────┐   ┌──────────────────────────┐
│  Mobile App │   │  Web Frontend │   │  Public QR Ordering      │
│ (Expo/RN)   │   │  (Vite/React) │   │  (/qr/:tableId, /track)  │
└──────┬──────┘   └──────┬───────┘   └────────────┬─────────────┘
       │ HTTP + Socket.io  │ axios + Socket.io      │ public axios
       ▼                    ▼                        ▼
┌──────────────────────────────────────────────────────────────┐
│                  Express 5 Backend (port 3000)                │
│  JWT (HttpOnly cookie + Bearer) · RBAC (6 roles, 60+ perms)  │
│  24 routers · Socket.io (outlet-isolated rooms) · Redis cache │
│  Audit log (23 action types) · ACID transactions              │
└──────┬──────────────┬──────────────┬──────────────┬───────────┘
       ▼              ▼              ▼              ▼
   MongoDB 7      Redis 7       Cloudinary     FURS SOAP /
  (ACID txn)     (cache)        (images)       Gemini AI /
                                               SMTP / Expo Push
```

---

## 🧱 Tech Stack

### Backend
- **Framework**: Express 5 + Node.js
- **Database**: MongoDB 7 + Mongoose 9 (ACID transactions)
- **Cache**: Redis 7 (with graceful degradation)
- **Real-time**: Socket.io 4 (outlet-isolated rooms)
- **Auth**: JWT (HttpOnly cookie + Bearer fallback for mobile)
- **RBAC**: 6 roles (admin, manager, cashier, waiter, kitchen, client), 60+ permissions
- **External**: Cloudinary, Google Gemini AI, ECB/Frankfurter FX, FURS SOAP (mTLS), Nodemailer/SMTP, Expo Push API
- **Testing**: Vitest + Supertest + mongodb-memory-server

### Frontend
- **Framework**: React 19 + Vite (rolldown-vite)
- **Styling**: Tailwind CSS 4 + shadcn/ui (New York style)
- **State**: Zustand 5 (22 stores) + TanStack patterns
- **Real-time**: Socket.io-client 4
- **i18n**: i18next (Slovenian default, English fallback)
- **Charts**: Recharts
- **Testing**: Vitest + React Testing Library + jsdom

### Mobile
- **Framework**: Expo SDK 52 / React Native 0.76
- **Navigation**: React Navigation 7 (bottom-tabs)
- **State**: Zustand 5
- **Offline**: expo-sqlite (offline queue with auto-flush)
- **Auth**: expo-secure-store (JWT storage)
- **Push**: expo-notifications (Expo Push API)
- **Real-time**: socket.io-client (KitchenScreen)

---

## ✨ Key Features

### Core POS
- **Order management**: Dine-in/Takeaway, split payments, course routing, modifiers
- **Kitchen Display System (KDS)**: Real-time Socket.io, sound alerts, station filters
- **Table management**: Floor plan editor, reservations, table timers
- **Menu management**: Categories, modifiers (BoM), spice levels, dietary tags

### Financial
- **Multi-currency**: EUR/USD/GBP/CHF/HRK/RSD/PKR with live ECB exchange rates
- **Tax**: Dynamic DDV (22%/9.5%/5%) — tax-inclusive or tax-exclusive
- **FURS fiscal**: ZOI/EOR/QR generation, SOAP mTLS, 10-year archive
- **Z-Report/X-Report**: Daily reconciliation, DDV breakdown, cash drawer

### Inventory
- **Recipe BoM**: Link menu items to inventory ingredients with quantities
- **Stock Movement**: Audit trail (order/restock/waste/adjust/transfer/return)
- **Automatic depletion**: Order completion → stock deduction
- **AI Forecast**: Gemini AI predicts stock depletion based on recipes + order history
- **Low stock alerts**: Push notification to admin/manager when quantity ≤ reorderLevel

### Customer
- **QR ordering**: Public menu + cart + checkout (no app required)
- **Order tracking**: Public page with auto-refresh timeline
- **Loyalty program**: Bronze/Silver/Gold/Platinum tiers, point multipliers, rewards
- **Customer profiles**: Visit history, preferences, spend totals

### Multi-Outlet
- **Chain management**: Multiple locations, shared menu/clients, separate tables/inventory/staff
- **Socket.io isolation**: Outlet-scoped rooms (orders don't leak between outlets)
- **Per-outlet**: Currency override, tax number, manager, opening hours

### Security & Compliance
- **Audit log**: 23 action types (auth, orders, payments, loyalty, currency, backup, inventory)
- **RBAC**: Per-route permissions (frontend + backend)
- **PIN login**: bcrypt-hashed 4-digit PIN (web + mobile)
- **Password security**: bcrypt hashing, no hash in API responses
- **Atomic payments**: Transaction + optimistic locking (no double-pay)

### Offline Resilience
- **Web**: IndexedDB queue with exponential backoff + 409 dedupe
- **Mobile**: SQLite queue with auto-flush + network detection
- **OfflineBanner**: Connection status + pending count

---

## 📁 Repository Structure

```
Tasty-Station-POS/
├── backend/                 # Express 5 API + Socket.io
│   ├── controllers/         # 17 controllers
│   ├── models/              # 18 models (user, order, recipe, stockMovement, ...)
│   ├── routers/             # 24 routers
│   ├── middlewares/         # auth, rbac, auditLog, cache, error
│   ├── utils/               # furs, pushService, emailService, logger
│   └── __tests__/           # 22 test files (172 tests)
├── frontend/                # Vite + React 19
│   ├── src/pages/Admin/     # 22 admin pages (lazy-loaded)
│   ├── src/pages/dashboard/ # 8 POS pages
│   ├── src/pages/QR/        # 2 public pages
│   ├── src/store/           # 22 Zustand stores
│   ├── src/components/ui/   # 22 shadcn components
│   └── src/test/            # 12 test files (74 tests)
├── mobile/                  # Expo / React Native
│   ├── src/screens/         # 5 screens (Login, Dashboard, Menu, Order, Kitchen)
│   ├── src/api/             # client, socket, config, notifications, offlineQueue
│   └── src/store/           # authStore
├── docs/                    # architecture, diagrams, plans, reports
├── .github/workflows/       # CI (backend + frontend lint/test/build)
└── CHANGELOG.md             # v1.0.0 → v1.7.0
```

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- MongoDB 7 (or use in-memory fallback for dev)
- Redis 7 (optional — set `REDIS_SKIP=true` to disable)

### Backend
```bash
cd backend
cp .env.example .env  # configure JWT_SECRET, MONGO_URI, etc.
npm install
npm run dev           # starts on port 3000
npm run seed          # seed demo data (dev only)
```

### Frontend
```bash
cd frontend
npm install
npm run dev           # starts on port 5173
```

### Mobile
```bash
cd mobile
cp .env.example .env  # set EXPO_PUBLIC_API_URL
npm install
npm start             # Expo dev server
```

---

## 🔐 Security

See [SECURITY.md](./SECURITY.md) for full policy. Key points:
- JWT in HttpOnly cookies (web) + Bearer tokens (mobile)
- PINs bcrypt-hashed (never plaintext)
- Per-route RBAC (frontend + backend)
- 0 npm vulnerabilities (both backend + frontend)
- Audit log for 23 action types

---

## 📚 Documentation

- [README.md](./readme.md) — comprehensive feature list + setup
- [CHANGELOG.md](./CHANGELOG.md) — version history (v1.0.0 → v1.7.0)
- [SECURITY.md](./SECURITY.md) — security policy + git history cleanup
- [DEPLOYMENT.md](./DEPLOYMENT.md) — Vercel/Railway/Docker deployment
- [CONTRIBUTING.md](./CONTRIBUTING.md) — contribution guidelines
- [docs/reports/testing_report.md](./docs/reports/testing_report.md) — QA metrics

---

## 🎯 Production Readiness

| Dimension | Status | Notes |
|---|---|---|
| **Functionality** | ✅ Ready | 23/24 roadmap items done |
| **Tests** | ✅ Ready | 246/246 green |
| **Lint** | ✅ Ready | 0 errors |
| **Security** | ✅ Ready | 0 vulnerabilities, audit log, RBAC |
| **Build** | ✅ Ready | Optimized chunks, successful |
| **CI/CD** | ✅ Ready | Quality gate enabled |
| **Documentation** | ✅ Ready | README + CHANGELOG + SECURITY |
| **Deployment** | ⚠️ Pending | Only roadmap item left |

**Verdict**: Production-ready pending deployment setup.
