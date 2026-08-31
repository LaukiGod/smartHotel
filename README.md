# Hotel Management System — Backend

Multi-tenant, QR-based in-restaurant ordering and management.
Many restaurants run on one deployment, each with its own data, staff, menu and tables.
Customers order via QR scan. Staff manage orders. Admin manages their restaurant.
A platform administrator manages the restaurants themselves.

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js v5
- **Database:** MongoDB + Mongoose (shared database, tenant-scoped documents)
- **Auth:** Google OAuth2 (Passport.js) + JWT
- **AI:** Google Generative AI (allergy checker)

---

## How tenancy works

Every restaurant is a `Restaurant` document with a URL-safe `slug`. Every other
document — order, table, dish, inventory item, guest, staff member — carries a
required `restaurant` reference.

**1. The slug is the boundary.** All tenant routes live under `/api/r/:slug/...`.
`resolveTenant` turns that slug into `req.restaurant` plus `req.db`, a scoped
model bundle.

**2. Services cannot escape the scope.** No service imports a Mongoose model
directly; they only get `req.db`, where every read is filtered by `restaurant`
and every write stamped with it. Critically, `findById(id)` is rewritten to
`findOne({ _id: id, restaurant })` — so an id guessed or leaked from another
restaurant returns 404 rather than data.

```js
// services never do this any more:
await Order.findById(orderId)                    // global — could be any tenant

// they do this:
await db.Order.findById(orderId)                 // -> { _id, restaurant } — scoped
```

**3. Tokens are pinned to a tenant.** The JWT carries `restaurantId` and
`restaurantSlug`. `enforceTenantMatch` rejects a token from restaurant A used
against restaurant B. `SUPER_ADMIN` (which has `restaurant: null`) passes through
any tenant by design.

**4. Uniqueness is per restaurant.** What used to be globally unique is now
compound: `(restaurant, tableNo)`, `(restaurant, dishId)`, `(restaurant, email)`,
`(restaurant, googleId)`. So every restaurant has a table 1 and a dish 1, and one
person can be staff at two restaurants with a different role at each.

---

## Folder Structure

```
smartHotel/
├── app.js                        # Express app + route mounts
├── server.js                     # Entry point
├── config/
│   ├── database.js               # MongoDB connection
│   └── passport.js               # Google OAuth2, tenant read from signed state
├── entities/
│   ├── restaurant.entity.js      # the tenant itself
│   ├── user.entity.js            # customer (table session)
│   ├── staff.entity.js           # SUPER_ADMIN / ADMIN / STAFF
│   ├── table.entity.js
│   ├── order.entity.js
│   ├── dish.entity.js
│   └── inventory.entity.js
├── controllers/
│   ├── user.controller.js
│   ├── restaurant.controller.js
│   ├── staffAuth.controller.js
│   └── platform.controller.js    # SUPER_ADMIN console
├── services/
│   ├── user.service.js
│   ├── restaurant.service.js
│   ├── platform.service.js
│   └── qr.service.js
├── routes/
│   ├── auth.routes.js            # global OAuth callback
│   ├── platform.routes.js        # /api/platform
│   ├── user.routes.js            # /api/r/:slug/user
│   ├── restaurant.routes.js      # /api/r/:slug/restaurant
│   └── staffAuth.routes.js       # /api/r/:slug/auth
├── middlewares/
│   ├── tenant.middleware.js      # resolveTenant + enforceTenantMatch
│   └── staffAuth.middleware.js   # authenticate + authorize + requireSuperAdmin
├── scripts/
│   └── migrate-to-multitenant.js # one-time upgrade for an existing database
└── utils/
    ├── tenantScope.js            # THE isolation layer — scoped(restaurantId)
    ├── tenantProvision.js        # create + seed a restaurant, or destroy one
    ├── jwt.js                    # tenant-stamped tokens + signed OAuth state
    ├── allergyChecker.js
    ├── helpers.js
    └── seed.js
```

---

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Configure environment

```bash
cp env.example .env
```

Set at minimum `MONGO_URI_LOCAL`, `JWT_SECRET`, `FRONTEND_URL`, the Google keys,
and `PLATFORM_ADMIN_EMAIL`.

> `FRONTEND_URL` must be `http://localhost:5173` for local Vite — it drives CORS,
> the post-login redirect, and the base of every table QR code.

### 3. Google OAuth2 setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → **APIs & Services** → **Credentials** → **Create OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Authorized redirect URI: `http://localhost:5000/api/auth/google/callback`

   Only **one** redirect URI is needed no matter how many restaurants exist — the
   tenant travels in the signed `state` parameter, not the callback URL.
5. Copy **Client ID** and **Client Secret** into `.env`

### 4. Seed the platform

```bash
npm run seed
```

This creates the SUPER_ADMIN from `PLATFORM_ADMIN_EMAIL`. Optionally set
`SEED_RESTAURANT_NAME` to also create a first restaurant in the same step.

### 5. Run

```bash
npm run dev     # development
npm start       # production
```

### 6. Create restaurants

Sign in at `{FRONTEND_URL}/platform/login` with the platform admin's Google
account, then **Add restaurant**. Each one is created with its tables, a starter
menu and its first ADMIN in a single step.

---

## Upgrading an existing single-restaurant database

The old schema has no `restaurant` field and has global unique indexes
(`tableNo_1`, `dishId_1`, `email_1`, `googleId_1`) that make a second restaurant
impossible. Run the migration once:

```bash
# preview, writes nothing
node scripts/migrate-to-multitenant.js --name "Bella Vista" --dry-run

# apply
npm run migrate:multitenant -- --name "Bella Vista" --slug bella-vista
```

It creates the restaurant, drops the legacy indexes, backfills `restaurant` on
every existing document, and builds the new compound indexes. It is idempotent.

Existing SUPER_ADMIN rows keep `restaurant: null`; all other staff are attached
to the new restaurant.

> **Reprint your table QR codes afterwards.** They now encode
> `/r/<slug>/user/table-select/<tableNo>`; the old codes have no tenant in them.

---

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 5000) |
| `MONGO_URI` / `MONGO_URI_LOCAL` | MongoDB connection string |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | One global callback; must match Google Console |
| `JWT_SECRET` | Long random string; also signs the OAuth `state` |
| `JWT_EXPIRES_IN` | Token expiry e.g. `8h`, `1d` |
| `FRONTEND_URL` | Frontend origin — CORS, login redirect, QR base |
| `PLATFORM_ADMIN_EMAIL` | Google email seeded as SUPER_ADMIN |
| `PLATFORM_ADMIN_NAME` | Display name for that account |
| `SEED_RESTAURANT_NAME` | Optional: create one restaurant while seeding |
| `SEED_RESTAURANT_SLUG` | Optional: its slug (derived from name if blank) |
| `SEED_RESTAURANT_TABLES` | Optional: table count (default 10) |
| `SEED_ADMIN_EMAIL` | Optional: that restaurant's first ADMIN |
| `SKIP_SEED` | Set to `1` to skip seeding on `npm install` |

---

## Authentication Flow (Staff / Admin)

```
Platform admin creates the restaurant  ->  its first ADMIN is seeded
          v
That ADMIN pre-registers staff via POST /api/r/<slug>/auth/staff
          v
Staff opens GET /api/r/<slug>/auth/google
          v
Backend signs state = { slug } and sends the browser to Google
          v
Google redirects to the ONE callback: /api/auth/google/callback?state=...
          v
Strategy verifies state, looks the email up WITHIN that restaurant only
          v
JWT stamped with restaurantId + restaurantSlug
          v
Redirect to FRONTEND_URL/r/<slug>/auth/callback?token=...
          v
Frontend stores it under token:<slug> and sends Authorization: Bearer <token>
```

A token issued for `bella-vista` presented to `/api/r/other-place/...` is rejected
with 403 by `enforceTenantMatch`.

---

## API Reference

See [api-doc.md](./api-doc.md) for the full endpoint tables.

Quick shape:

| Prefix | Scope |
|---|---|
| `/api/platform/...` | SUPER_ADMIN — manage restaurants |
| `/api/auth/...` | Shared OAuth callback |
| `/api/r/:slug/auth/...` | Staff login + staff management for one restaurant |
| `/api/r/:slug/restaurant/...` | Staff/admin operations for one restaurant |
| `/api/r/:slug/user/...` | Public customer/kiosk surface for one restaurant |
