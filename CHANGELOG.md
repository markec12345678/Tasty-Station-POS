# Changelog

Vse pomembne spremembe v Tasty Station POS projektu.

Format temelji na [Keep a Changelog](https://keepachangelog.com/slo/1.1.0/),
in projekt upošteva [Semantic Versioning](https://semver.org/lang/sl/).

---

## [1.7.0] — 2025-07-03 — Frontend Stock Movement UI

v1.6.0 je dodal backend stock movement sistem brez admin UI-ja. Ta release
doda poln admin UI za pregled in upravljanje stock gibanj — s čimer je cikel
stock managementa popolnoma zaprt (backend → testi → UI). 172/172 testov
zelenih (0 regresij).

### 🎨 Frontend — Stock Movement Management UI (nova admin stran)

- **Nova admin stran `StockMovementManagement.jsx`** (`/admin/stock-movements`):
  - **Stats dashboard** (4 kartice):
    - Total Consumed (€) — skupna vrednost porabe v obdobju
    - Movements — skupno število gibanj
    - Restocks — število dopolnitev
    - Waste — število odpisov
  - **Top 5 Consumed Items** — najbolj porabljeni inventory item-i z vrednostjo
  - **Filtri** — type (order/restock/waste/adjustment/transfer/return),
    inventory item, datumski range (start/end)
  - **Movements tabela** — datum, type badge z ikono, item (klikabilen za
    stock card), change (barvno: rdeča negativno/emerald pozitivno),
    before/after, value (€), reason, user
  - **Paginacija** — 50 gibanj na stran
  - **Restock dialog** — inventory selector, quantity, cost per unit
    (optional — posodobi ceno), reason
  - **Adjust dialog** — inventory selector, new quantity, reason (obvezen),
    live preview spremembe (current → new z barvno kodiranim delta)
  - **Stock Card dialog** — klik na inventory ime odpre polno zgodovino
    gibanj za ta item (timeline format z type badges)
  - **RBAC**: `inventory:read` za branje, `inventory:update` za restock/adjust

- **Nov `useStockMovementStore.js`** Zustand store — getMovements (z filtri
  in paginacijo), getStats, getInventoryHistory (stock card), restock, adjust.

- **AdminSidebar.jsx** — nov menu item "Stock Movements" z History ikono,
  prikazuje se za admin/manager/cashier (permission: inventory:read).

- **App.jsx** — nova lazy-loaded route `/admin/stock-movements` z
  ProtectedRoute guard (permission: inventory:read).

### 🎨 UI/UX podrobnosti

- **Barvno kodiranje tipov gibanj**:
  - Order (modra) — avtomatska poraba ob prodaji
  - Restock (emerald) — dopolnitev od dobavitelja
  - Waste (rdeča) — odpis (zaprtež, iztek roka)
  - Adjustment (rumena) — ročna korekcija
  - Transfer (vijolična) — prenos med outlet-i
  - Return (cyan) — vračilo ob preklicu orderja
- **Live preview v Adjust dialogu** — admin vidi trenutno zalogo in
  izračunano spremembo (current → new z delta) pred potrditvijo
- **Stock Card pogled** — klik na inventory ime v tabeli odpre polno
  zgodovino tega item-a (timeline format)

### 📊 Cilj

Stock movement backend (v1.6.0) je bil brez UI-ja neuporaben za admin
uporabnike. Sedaj ima admin poln nadzor:
1. Vidi celotno zgodovino sprememb zaloge z filtri
2. Lahko ročno dopolni zalogo (restock) z opcijsko posodobitvijo cene
3. Lahko korigira zalogo (adjust) z obveznim reason-om za audit
4. Vidi "stock card" za vsak inventory item (polna zgodovina)
5. Analizira porabo (top consumed, skupna vrednost, število odpisov)

### 🧪 Test Results

- **Backend: 172/172 PASS** (0 regresij — frontend spremembe ne vplivajo)
- **Frontend lint: 0 errors** (na spremenjenih datotekah)
- Vsi novi fajli se uspešno transpilirajo

---

## [1.6.0] — 2025-07-03 — Automatic Stock Depletion + Audit Trail

Recipe BoM (v1.3.0) je omogočil recipe costing in forecasting, vendar zaloga
ni bila avtomatsko zmanjšana ob prodaji. Ta release implementira pravi
"stock movement" sistem (Toast POS / Apicbase parity): ob vsakem naročilu
se zaloga avtomatsko zmanjša preko receptov, vsaka sprememba pa se zabeleži
v audit trail. 17 novih testov, skupaj 172/172 zelenih.

### 📦 Stock Movement System (Toast POS parity)

- **Nov `StockMovement` model** (`backend/models/stockMovement.model.js`) —
  audit trail vseh sprememb zaloge. 6 tipov gibanj:
  - `order` — avtomatska poraba ob createOrder (preko Recipe BoM)
  - `restock` — ročna dopolnitev (od dobavitelja)
  - `waste` — odpis (zaprtež, iztek roka, poškodba)
  - `adjustment` — ročna korekcija (inventario, popravki)
  - `transfer` — prenos med outlet-i (multi-outlet)
  - `return` — vračilo (preklican order)
  - Vsako gibanje beleži: quantityBefore, quantityAfter, quantityChange,
    costPerUnit, totalValue, order ref, menuItem ref, outlet, user, reason.

- **Nov `stockMovement.js` helper** (`backend/utils/stockMovement.js`):
  - `depleteStockForOrder(validItems, { order, outlet, user, session })` —
    avtomatsko zmanjša zalogo ob createOrder. Za vsak order item poišče
    Recipe (BoM) in za vsako sestavino: preveri zadostnost, zmanjša
    Inventory.quantity, zabeleži StockMovement. Če ni dovolj zaloge →
    throw ApiError(409) → transakcija rollback (order se ne ustvari).
  - `restockForCancelledOrder(order, user)` — vrne zalogo ob preklicu
    orderja. Idempotentno (double-cancel ne double-restock).

- **`createOrder` integracija** — stock depletion se izvede po client history
  update, pred commit transaction. Insufficient stock → rollback z 409.
  Low-stock alert se emitira preko Socket.io (`lowStockAlert` event).

- **`updateOrderStatus` integracija** — ob preklicu (Cancelled) se pokliče
  `restockForCancelledOrder`, ki vrne vse sestavine nazaj v zalogo.

### 🌐 Stock Movement API

- **Nov `stockMovement.router.js`** z 5 endpointi:
  - `GET /api/stock-movements` — seznam z filtri (inventory, type, order,
    outlet, date range) + paginacija
  - `GET /api/stock-movements/stats` — agregirana statistika (by type,
    top consumed, totals) za dashboard
  - `GET /api/stock-movements/inventory/:id` — celotna zgodovina za item
    ("stock card" pogled)
  - `POST /api/stock-movements/restock` — ročna dopolnitev (admin/manager)
  - `POST /api/stock-movements/adjust` — ročna korekcija z obveznim reason

### 🧪 Testi (17 novih)

- **`__tests__/api/stockMovement.api.test.js`** (17 testov):
  - **Stock depletion on createOrder** (7 testov):
    - Zmanjša zalogo preko Recipe BoM (0.2kg beef + 1 bun per burger)
    - Ustvari StockMovement audit trail (quantityBefore/After, costPerUnit)
    - Zavrne order z 409, če ni dovolj zaloge (rollback transakcije)
    - Brez recepta → zaloga se ne spremeni (graceful)
    - Opcijske sestavine se ne deplete-ajo
    - Cancel order → restock (vrne zalogo)
    - Restock idempotentno (double-cancel ne double-restock)
  - **Stock Movement API** (10 testov):
    - GET seznam z filtri (type, inventory)
    - POST restock (dopolni zalogo, posodobi costPerUnit)
    - POST adjust (korekcija z obveznim reason)
    - GET inventory history (stock card)
    - GET stats (agregirana statistika)
    - RBAC: cashier ne sme restock (403), lahko bere (200)
    - Validacije: negativna količina (400), prekratek reason (400)

### 📊 Test Coverage

| Modul | Prej | Sedaj | Δ |
|---|---|---|---|
| Stock depletion + audit | 0 | 17 | +17 |
| **Skupaj** | **155** | **172** | **+17** |

### 🎯 Praktični vpliv

1. **Pravi inventory tracking** — zaloga se samodejno posodablja ob vsaki
   prodaji, ne več ročno. Admin vidi real-time stanje.
2. **Insufficient stock prevention** — če stranka naroči 60 burgerjev,
   a imamo samo 10kg beef-a, order se zavrne z jasno napako (409) namesto
   da bi šlo v negativno zalogo.
3. **Full audit trail** — vsaka sprememba zaloge je sledljiva (kdo, kdaj,
   zakaj, koliko). Podporno za inventuro in waste tracking.
4. **Cancel = restock** — preklic orderja samodejno vrne sestavine v zalogo.
5. **Low-stock real-time alert** — admin dashboard takoj vidi, katere
   sestavine so padle pod reorder level.

### 🔍 Reference

- Toast POS — "stock movements" + "recipe costing" (certus-ai comparison)
- Apicbase — "inventory audit" + "F&B BOM" (get.apicbase.com)
- NetSuite — "Bill of Materials" (netsuite.com)

### 🧪 Test Results

- **Backend: 172/172 PASS** (0 regresij, 0 preskakovanj)
- **Backend lint: 0 errors**
- Duration: ~50 sekund

---

## [1.5.0] — 2025-07-03 — Frontend Recipe UI + Socket.io Isolation Tests

v1.3.0 je dodal Recipe (BoM) backend, brez admin UI-ja. Ta release doda
poln admin UI za upravljanje receptov + 8 novih testov za Socket.io outlet
izolacijo. Skupaj 155/155 testov zelenih.

### 🎨 Frontend — Recipe Management UI (nova admin stran)

- **Nova admin stran `RecipeManagement.jsx`** (`/admin/recipes`) — poln CRUD
  UI za recepte z:
  - **Stats dashboard**: skupno število receptov, povprečna cena, povprečna
    marža, skupno število sestavin
  - **Iskalna vrstica** — filter po imenu menu item-a
  - **Seznam receptov** — vsak recept prikazuje: menu item (sliko + ime),
    število sestavin, prep time, badge-za prve 4 sestavine, cost/price/margin
    z barvno kodiranjem (zelena ≥70%, rumena ≥50%, rdeča <50%)
  - **Create/Edit dialog** — menu item selector, dinamična lista sestavin
    (add/remove), inventory dropdown s prikazom cene, quantity, unit, optional
    checkbox, instructions textarea, prep time input
  - **Costing dialog** — detailed breakdown: computed cost, sale price, gross
    profit, margin %, per-ingredient line cost
  - **Info banner** — razlaga, zakaj so recepti pomembni (AI forecasting +
    recipe costing)
  - **RBAC**: uporablja `menu:read` permission (admin + manager)

- **Nov `useRecipeStore.js`** Zustand store — getRecipes, getRecipeByMenuItem,
  saveRecipe (upsert), deleteRecipe (soft), getCosting.

- **AdminSidebar.jsx** — nov menu item "Recipes (BoM)" z BookOpen ikono,
  prikazuje se za admin/manager (permission: menu:read).

- **App.jsx** — nova lazy-loaded route `/admin/recipes` z ProtectedRoute
  guard (permission: menu:read).

### 🧪 Backend — Socket.io Outlet Isolation Tests (8 novih testov)

- **`__tests__/socket.outlet-isolation.test.js`** — integration testi za
  `emitToOutlet` helper (v1.2.0):
  - Pošiljanje dogodka v pravo outlet sobo
  - Vedno pošlje tudi v `outlet:global` (admin dashboard)
  - Drug outlet NE prejme dogodka (izolacija)
  - Null/undefined outletId → global soba (QR naročila)
  - Podpora za vse event tipe (newOrder, paymentUpdate, orderStatusUpdate,
    courseSent)
  - No-crash, ko io ni inicializiran
  - Deep equality payload preverjanje

### 📊 Test Coverage

| Modul | Prej | Sedaj | Δ |
|---|---|---|---|
| Socket.io outlet isolation | 0 | 8 | +8 |
| **Skupaj** | **147** | **155** | **+8** |

### 🎯 Cilj

Recipe backend (v1.3.0) je bil brez UI-ja neuporaben za admin uporabnike.
Sedaj ima admin poln nadzor nad recepti:
1. Ustvari/uredi recept z dinamično listo sestavin
2. Vidi real-time costing (cost, price, profit, margin)
3. Razume, katere menu item-e pokriva pravi recept (consumptionSource)
4. AI inventory forecasting sedaj dejansko deluje, ko so recepti vnešeni

### 🧪 Test Results

- **Backend: 155/155 PASS** (0 regresij, 0 preskakovanj)
- **Backend lint: 0 errors**
- **Frontend lint: 0 errors** (na spremenjenih datotekah)
- Duration: ~45 sekund

---

## [1.4.0] — 2025-07-03 — Test Coverage for Critical Business Logic

Po v1.1.0–v1.3.0 popravkih je bila kritična poslovna logika (plačila, FURS,
recepti, seed varnost) brez testov. Ta release zapre te vrzeli z 62 novimi
testi v 4 novih testnih datotekah. Skupaj 147/147 testov zelenih.

### 🧪 Novi testi (62 testov, 4 datoteke)

- **`__tests__/furs.test.js`** (15 testov) — FURS QR koda in invoice numbering:
  - QR vsebina mora biti 60 znakov (39+12+8+1) — prepreči regresijo na staro
    `SI${date}${taxNumber}${zoi_hex}` format
  - Ne sme vsebovati "SI" prefix-a ali hex ZOI (stara napačna implementacija)
  - Decimal ZOI (39 znakov, left-pad) na začetku — BigInt pretvorba
  - Davčna številka (8 znakov, padded) na poziciji 51-59
  - Kontrolna števka (vsota števk mod 10) kot zadnji znak
  - Graceful fallback za neveljaven hex ZOI
  - Deterministični rezultati za iste vhode
  - Invoice numbering: OUTLET_CODE-YEAR-SEQUENCE format, inkrementiranje,
    default "TS" prefix, začetek pri 000001

- **`__tests__/models/recipe.test.js`** (8 testov) — Recipe (BoM) model:
  - Ustvarjanje veljavnega recepta s sestavinami
  - Unique index na menuItem (en recept na menu item)
  - `recomputeCost()` — pravilen izračun cene iz trenutnih cen inventarja
  - Ignoriranje sestavin z manjkajočo ceno
  - `getConsumptionForPortions(n)` — prava poraba za N porcij
  - Izpustitev opcijskih sestavin iz napovedi
  - Prazen rezultat za 0 ali negativne porcije
  - Soft delete (isActive = false)

- **`__tests__/api/order.payment.test.js`** (10 testov) — addPayment logika:
  - Prvo plačilo pravilno posodobi amountPaid/balanceDue
  - Split payments (Cash + Card) → paymentMethod = "Split"
  - Avtomatski prehod v Completed, ko je balanceDue = 0
  - Zavrnitev plačila, ki presega remaining balance (400)
  - Zavrnitev neveljavnega payment method (400)
  - Zavrnitev negativnega zneska in zneska 0 (400)
  - 404 za neobstoječi order
  - Boundary: plačilo točno remaining balance
  - Floating-point tolerance (0.01) za preplačilo

- **`__tests__/api/recipe.api.test.js`** (15 testov) — Recipe API CRUD:
  - POST ustvarjanje recepta z computedCost
  - Validacije: manjkajoč menuItem (400), prazne sestavine (400),
    negativna količina (400), neobstoječ inventory (404), neobstoječ
    menuItem (404)
  - Upsert: drugi POST za isti menuItem posodobi (ne duplicira)
  - GET seznam receptov
  - GET recept za specifičen menuItem (200 + 404)
  - GET recipe costing z maržo in profitom
  - DELETE soft-delete (isActive = false)
  - RBAC: cashier ne sme ustvarjati (403), lahko bere (200)

- **`__tests__/seed.env-gating.test.js`** (12 testov) — Seed varnost:
  - `shouldSeedDemoUsers()` logika — 9 scenarijev
    (development, production, explicit override, priority, neveljavne vrednosti)
  - Production bootstrap validacija — 3 scenariji
    (manjkajoči env vars → jasna napaka, oba env vars → OK,
    samo email brez password → napaka)

### 🔧 Infrastruktura

- **`__tests__/setup.db.js`** — Socket.io mock razširjen z `emitToOutlet` in
  `emitGlobal` (v1.2.0 helperja, ki jih kontrolerji uporabljajo).

### 📊 Pokritost po modulih

| Modul | Prej | Sedaj | Δ |
|---|---|---|---|
| FURS (QR, ZOI, invoice numbering) | 0 | 15 | +15 |
| Recipe model (BoM) | 0 | 8 | +8 |
| Recipe API (CRUD + costing) | 0 | 15 | +15 |
| Order payment (split, race) | 0 | 10 | +10 |
| Seed env-gating | 0 | 12 | +12 |
| **Skupaj** | **85** | **147** | **+62** |

### 🎯 Kritična logika, ki je zdaj pokrita

1. **FURS QR format** — preprečuje regresijo na napačen format (ki bi povzročil
   davčno neveljavne račune)
2. **addPayment** — preprečuje ponovitev race condition (double-pay)
3. **Recipe BoM** — preprečuje napake v recipe costing in inventory forecasting
4. **Seed env-gating** — preprečuje, da bi se demo gesla znova znašla v
   produkcijski bazi
5. **RBAC na recipe endpointih** — preprečuje, da bi cashier ustvarjal recepte

### 🧪 Test Results

- **Backend: 147/147 PASS** (0 regresij, 0 preskakovanj)
- **Backend lint: 0 errors**
- Duration: ~42 sekund

---

## [1.3.0] — 2025-07-03 — Industry Parity (FURS QR, Recipe BoM, Redis Adapter)

Raziskava spleta in primerjava z referenčnimi implementacijami
(bostjanpisler/node-furs-fiscal-verification, Toast POS, Apicbase) je
razkrila tri kritične vrzeli. Vse tri so sedaj zaprte. 8 datotek spremenjenih,
2 novi datoteki.

### 💰 Financial Integrity (FURS) — Kritični popravki

- **FURS QR koda — popolnoma napačen format popravljen.** Prejšnja
  implementacija `generateQRContent` je generirala `SI${date}${taxNumber}${zoi_hex}`
  — to NI skladno s FURS tehnično specifikacijo v1.6. Pravilen format je:
  `ZOI_decimal(39, left-pad) + YYMMDDHHmmss(12) + TaxNumber(8) + ControlDigit(1) = 60 znakov`.
  Reference: bostjanpisler/node-furs-fiscal-verification, FURS uradna specifikacija.
  Stare QR kode ne bi bile berljive z uradno FURS mobilno aplikacijo za
  preverjanje računov. Sedaj: BigInt pretvorba hex→decimal, padding na 39,
  vsota števk mod 10 za kontrolno števko. Skupna dolžina vedno 60 znakov.

### 🍔 Recipe / Bill of Materials (Toast POS parity)

- **Nov `Recipe` model** (`backend/models/recipe.model.js`) — povezuje MenuItem
  z Inventory postavkami s količinami (npr. "Cheeseburger" → 200g beef, 1 bun,
  1 cheese slice, 10g lettuce). To je prava metoda, ki jo uporablja Toast POS
  ("recipe costing") in Apicbase (F&B BOM).
  - `recomputeCost()` — preračuna ceno recepta iz trenutnih cen inventarja.
  - `getConsumptionForPortions(n)` — vrne pričakovan porabo za n porcij.
- **Nov `recipe.router.js`** — CRUD endpointi:
  - `GET /api/recipes` — seznam s populate
  - `GET /api/recipes/:menuItemId` — recept za specifičen menu item
  - `POST /api/recipes` — upsert (en recept na menu item)
  - `DELETE /api/recipes/:id` — soft delete
  - `GET /api/recipes/:menuItemId/cost` — recipe costing (computedCost,
    salePrice, grossProfit, marginPercent, sestavine z lineCost)
- **`inventoryForecast.controller` popolnoma prenovljen** — namesto naivnega
  tekstovnega ujemanja (menuItem.name vsebuje prvo besedo inventory.name) sedaj
  uporablja Recipe BoM za pravo izračunavanje porabe. Vsak inventory item
  dobi `consumptionSource: "recipe" | "heuristic" | "none"` za transparentnost
  (admin vidi, katere item-e pokriva pravi recept in katere še vedno hevristika).
  Fallback na hevristiko ostaja za menu item-e brez recepta.

### 📡 Socket.io Horizontal Scaling

- **Redis adapter** (`@socket.io/redis-adapter`) — samodejno se priključi, če
  je Redis povezan. Omogoča multi-node broadcast: več backend instanc (npr.
  Kubernetes cluster) delijo Socket.io dogodke prek Redis pub/sub. Brez
  adapterja dogodki ne preidejo med instancami (kuhalnica na instanci B ne bi
  videla naročila, ki je prišlo na instanco A). Reference: Socket.io docs
  "Using multiple nodes", Ably "Scaling Socket.IO in production".
  - Graceful fallback: če Redis ni povezan ali paket ni nameščen, deluje
    single-node (backward-compat).
  - Ločena pub/sub klienta (adapter zahteva dve povezavi).

### 📚 Documentation

- **`.env.example`** — dodan `@socket.io/redis-adapter` v devDependencies.
- **CHANGELOG** — v1.3.0 vnos s polno sledljivostjo in referencami.

### 🧪 Tests

- 85/85 backend testov še vedno zelenih (0 regresij). Nov Recipe model in
  router sta additive — ne vplivata na obstoječe teste. FURS QR popravek
  vpliva samo na `fiscalQR` polje v FiscalInvoice (testi ne preverjajo
  vsebine QR kode, samo obstoj).

### 🔍 Research References

- `bostjanpisler/node-furs-fiscal-verification` — slovenska open-source FURS
  knjižnica, referenca za pravi ZOI/QR format.
- FURS uradna tehnična specifikacija v1.6 (edavki.durs.si).
- Socket.io docs v4 — "Using multiple nodes" (Redis adapter pattern).
- Toast POS — "recipe costing and vendor management" (certus-ai comparison).
- Apicbase — "F&B Bills of Materials" (get.apicbase.com).
- Ably Realtime — "What it really takes to scale Socket.IO in production".

---

## [1.2.0] — 2025-07-02 — Multi-Outlet Isolation, FURS Hardening, Seed Safety

Nadaljevanje varnostnega in arhitekturnega audit-a. Fokus na pravilnosti
multi-outlet postavitve, davčni skladnosti FURS v produkciji in odstranitvi
demo gesel iz produkcijskih okolij. 11 datotek spremenjenih.

### 🔒 Security

- **Demo gesla v produkciji** — `seed.js` in `dev.js` sta v `NODE_ENV=production`
  seedala demo uporabnike (`admin@pos.com` / `password123`) s plaintext
  gesli, ki bi bili v produkciji takoj kompromitirani. Sedaj se demo uporabniki
  seedajo SAMO ko `NODE_ENV !== 'production'` ALI ko je `SEED_DEMO_USERS=true`.
  V produkciji seeder ustvari samo admin iz `SEED_ADMIN_EMAIL` /
  `SEED_ADMIN_PASSWORD` env spremenljivk (PIN opcijski).
- **FURS random ZOI v produkciji** — `furs.js:confirmInvoice` je ob manjkajočem
  certifikatu generiral random MD5 kot ZOI. V produkciji to pomeni davčno
  neveljavne račune (kršitev ZDavPR). Sedaj: v produkciji hard fail (return
  `{ success: false, error }`), v dev/test še dovoljen random fallback.

### 💰 Financial Integrity (FURS)

- **Dinamični FURS identifikatorji** — `buildSOAPEnvelope` in `confirmInvoice`
  sta imela hardcoded `businessUnit="1"` in `cashRegister="1"`. Outleti z več
  blagajnami ali predhodno prijavljenimi FURS oznakami tega niso mogli
  upoštevati. Dodani polji `Outlet.businessUnit` in `Outlet.cashRegister`
  (default `"1"` za backward-compat). `confirmInvoice` sedaj uporablja
  `outlet.businessUnit` / `outlet.cashRegister` in shrani prave vrednosti
  v `FiscalInvoice`.
- **OutletManagement UI** — dodani input polji za FURS Business Unit in
  Cash Register v dialogu za urejanje outlet-a.

### 🏢 Multi-Outlet Sync (Real-Time Isolation)

- **Socket.io outlet sobe** — vsi `io.emit(...)` klici v `order.controller.js`
  in `public.router.js` so pošiljali dogodke (`newOrder`, `orderStatusUpdate`,
  `paymentUpdate`, `courseSent`, `qrOrderPlaced`) VSEM prijavljenim odjemalcem.
  Pri multi-outlet postavitvi je kuhalnica lokacije A videla naročila lokacije B.
  Novi helper `emitToOutlet(outletId, event, data)` pošlje dogodek samo v sobo
  `outlet:<outletId>` (+ `outlet:global` za admin dashboard).
- **Table.outletId polje** — dodano additivno polje (default null) na Table
  model, da QR naročila pridobijo outlet kontekst iz mize. `public.router.js`
  sedaj nastavi `order.outletId = table.outletId` in uporabi `emitToOutlet`.
- **Frontend `join-outlet` event** — `frontend/src/config/socket.config.js`
  ob vsakem (re)connect-u pošlje `join-outlet` z `authUser.outletId` (iz
  Zustand persist storage-a). Nov helper `joinOutletRoom(outletId)` za
  preklop outlet-a brez ponovne prijave.

### 📚 Documentation Accuracy

- **README.md** — popravljene zastarele števce: routers 22 → 23, admin pages
  17 → 20, Zustand stores 17 → 22. Demo credentials tabela ima zdaj PIN stolpec
  + warning, da se seedajo samo v non-production. Roadmap dopolnjen z 3 novimi
  done item-i (FURS hardening, Socket.io outlet isolation, Seed env-gating).
- **SECURITY.md** — odstranjene napačne trditve o PWA / Service Worker
  (PWA je bil odstranjen v v1.1.0). Demo credentials razdelek razširjen z
  razlago env-gating logike in PIN-i. "Service Worker (PWA)" razdelek
  preimenovan v "Offline Queue (IndexedDB)".
- **DEPLOYMENT.md** — "PWA cache issues" razdelek preimenovan v "Offline queue
  / browser cache issues". Odstranjena referenca na "clear Service Worker cache".
- **`.env.example`** — dodan `SEED_DEMO_USERS`, `SEED_ADMIN_EMAIL`,
  `SEED_ADMIN_PASSWORD`, `SEED_ADMIN_NAME`, `SEED_ADMIN_PIN` z dokumentacijo.

### 🧪 Tests

- Brez regresij — obstoječi testi (backend 85/85, frontend 45/45) še vedno
  passajo. Novi helperji (`emitToOutlet`, `joinOutletRoom`) so additive in
  ne vplivajo na obstoječe Socket.io behaviour (admin dashboard še vedno
  prejema vse dogodke prek `outlet:global` sobe).

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
