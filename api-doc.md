# Restaurant Management API — Multi-Tenant Reference

Base URL (local development):

```
http://localhost:5000/api
```

All requests and responses use **JSON**, except the QR endpoint which returns `image/png`.

---

## The tenant boundary

Every restaurant is an isolated tenant. There are only two kinds of route:

| Shape | Scope | Example |
|---|---|---|
| `/api/platform/...` | Platform. SUPER_ADMIN only. | `GET /api/platform/restaurants` |
| `/api/auth/...` | Platform. The shared OAuth callback. | `GET /api/auth/google/callback` |
| `/api/r/:slug/...` | **One restaurant.** Everything else. | `GET /api/r/bella-vista/user/menu` |

`:slug` is resolved by `resolveTenant`, which:

1. looks the restaurant up (30s cache), returning **404** if unknown and **403** if suspended;
2. attaches `req.restaurant` and a tenant-scoped model bundle `req.db`.

Services never touch a Mongoose model directly — they only receive `req.db`, whose
every read is filtered by `restaurant` and every write stamped with it. `findById`
is rewritten to `findOne({ _id, restaurant })`, so guessing another tenant's
ObjectId returns 404 rather than their data.

For authenticated routes, `enforceTenantMatch` additionally rejects a token issued
for restaurant A when it is presented to restaurant B. SUPER_ADMIN passes through
any tenant.

---

## Platform APIs — `/api/platform`

All require `Authorization: Bearer <token>` with role **SUPER_ADMIN**.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/platform/me` | Own token payload |
| GET | `/platform/stats` | Restaurant / staff / order totals |
| GET | `/platform/restaurants` | List every restaurant with live counts |
| POST | `/platform/restaurants` | Create + seed a restaurant |
| GET | `/platform/restaurants/:id` | One restaurant plus its staff |
| PATCH | `/platform/restaurants/:id` | Edit name, contact, currency, logo |
| PATCH | `/platform/restaurants/:id/status` | Suspend or reactivate |
| DELETE | `/platform/restaurants/:id` | Destroy the tenant and all its data |
| GET | `/platform/super-admins` | List platform administrators |
| POST | `/platform/super-admins` | Add a platform administrator |

**POST `/platform/restaurants` body:**

```json
{
  "name": "Bella Vista",
  "slug": "bella-vista",
  "adminName": "Asha Rai",
  "adminEmail": "owner@bellavista.com",
  "tableCount": 12,
  "currency": "NPR",
  "seedMenu": true
}
```

`slug` is optional — it is derived from `name` and de-duplicated (`bella-vista-2`)
when omitted. Creation seeds the restaurant's tables, its starter menu, and its
first ADMIN in one step; if any of those fail the partially built tenant is rolled
back.

**Response:**

```json
{
  "message": "Restaurant \"Bella Vista\" created",
  "restaurant": { "_id": "...", "name": "Bella Vista", "slug": "bella-vista", "status": "active" },
  "seeded": { "tables": 12, "dishes": 40, "admin": "owner@bellavista.com" }
}
```

**DELETE `/platform/restaurants/:id` body:** deleting a tenant is irreversible, so
the slug must be echoed back:

```json
{ "confirmSlug": "bella-vista" }
```

---

## Auth APIs

Google permits only a fixed set of redirect URIs, so there is **one** callback for
the whole platform. The tenant travels in a signed, 10-minute `state` parameter,
which doubles as CSRF protection.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/api/r/:slug/auth/google` | Start staff login for one restaurant |
| GET | `/api/auth/platform/google` | Start SUPER_ADMIN login |
| GET | `/api/auth/google/callback` | Shared callback — issues the JWT |
| GET | `/api/auth/failed` | Failure response |

On success the browser is redirected to:

```
{FRONTEND_URL}/r/<slug>/auth/callback?token=<jwt>     (staff)
{FRONTEND_URL}/platform/auth/callback?token=<jwt>     (platform)
```

**JWT payload:**

```json
{
  "id": "...",
  "role": "ADMIN",
  "name": "Asha Rai",
  "email": "owner@bellavista.com",
  "restaurantId": "...",
  "restaurantSlug": "bella-vista"
}
```

`restaurantId` / `restaurantSlug` are `null` for SUPER_ADMIN.

### Staff management — `/api/r/:slug/auth`

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/auth/me` | Any staff | Own payload + restaurant |
| GET | `/auth/staff` | ADMIN | Staff at **this** restaurant |
| POST | `/auth/staff` | ADMIN | Pre-register a staff member |
| PATCH | `/auth/staff/:id/activate` | ADMIN | Activate |
| PATCH | `/auth/staff/:id/deactivate` | ADMIN | Deactivate |
| DELETE | `/auth/staff/:id` | ADMIN | Hard delete |

An email is unique **per restaurant**, not globally — the same person can be staff
at two restaurants, and each membership is a separate row with its own role.

---

## Customer APIs — `/api/r/:slug/user`

All public (no token). Isolation comes entirely from `:slug`.

| Method | Endpoint | Description |
|---|---|---|
| GET | `/user/restaurant` | Public identity: name, slug, currency, logo, table count |
| POST | `/user/login-table` | Start a table session (name + phone) |
| GET | `/user/table-select/:tableNo` | QR quick entry; claims the table |
| GET | `/user/table-session/:tableNo` | Read the current seating session |
| POST | `/user/set-allergies` | Set the seated guest's allergies |
| GET | `/user/menu` | Full menu for this restaurant |
| POST | `/user/order` | Place / append to an order |
| POST | `/user/confirm-order` | Confirm an order |
| GET | `/user/orders/:tableNo` | Orders for the current seating |
| POST | `/user/call-waiter` | Raise a waiter request |
| POST | `/user/meal-complete` | Complete the meal, send table to cleaning |
| POST | `/user/review` | Leave a rating + comment |
| POST | `/user/clear-table` | End the session, free the table |

Table numbers restart at 1 for every restaurant, and `isTableValid` now checks that
the table actually exists **in this tenant** rather than against a hardcoded range.

**POST `/user/order` body:**

```json
{ "tableNo": 5, "dishes": ["<dishId>", "<dishId>"] }
```

A dish id from another restaurant will not resolve — the response is
`One or more dishes not found`.

---

## Restaurant APIs — `/api/r/:slug/restaurant`

Require `Authorization: Bearer <token>` issued **for this slug**, except `/tables`.

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/restaurant/orders` | ADMIN, STAFF | Today's orders |
| POST | `/restaurant/order-status` | ADMIN, STAFF | Update order status |
| POST | `/restaurant/line-item-status` | ADMIN, STAFF | Update one kitchen line item |
| POST | `/restaurant/create-order` | ADMIN, STAFF | Staff-entered order |
| PUT | `/restaurant/update-order` | ADMIN, STAFF | Edit dishes / allergies |
| GET | `/restaurant/notifications` | ADMIN, STAFF | Counters for the navbar |
| GET | `/restaurant/alerts` | ADMIN, STAFF | Active allergy alerts |
| GET | `/restaurant/inventory` | ADMIN, STAFF | Inventory + expiry/low-stock buckets |
| POST | `/restaurant/add-inventory` | ADMIN | Add items (single or bulk) |
| PUT | `/restaurant/inventory/:id` | ADMIN | Update an item |
| DELETE | `/restaurant/inventory/:id` | ADMIN | Delete an item |
| GET | `/restaurant/tables` | Public | Table statuses for this restaurant |
| PATCH | `/restaurant/tables/:tableNo/available` | ADMIN, STAFF | Free a table |
| GET | `/restaurant/tables/count` | ADMIN | Highest table number |
| POST | `/restaurant/tables/increase` | ADMIN | Append one table |
| DELETE | `/restaurant/tables/:id` | ADMIN | Remove the highest table |
| GET | `/restaurant/metrics` | ADMIN | Revenue, covers, peak hours |
| GET | `/restaurant/menu` | ADMIN, STAFF | All dishes |
| POST | `/restaurant/add-dish` | ADMIN | Add a dish |
| PUT | `/restaurant/update-dish` | ADMIN | Update a dish |
| DELETE | `/restaurant/dish/:id` | ADMIN | Delete a dish |
| GET | `/restaurant/tables/:tableNo/qrcode` | ADMIN, STAFF | PNG QR for the table |

`dishId` is a **per-restaurant** counter, so two restaurants both have a dish 1.
The QR encodes `{FRONTEND_URL}/r/<slug>/user/table-select/<tableNo>` and prints the
restaurant name under the table number — reprint table QRs after migrating.

---

## Error responses

| Status | Meaning |
|---|---|
| 400 | Validation failure |
| 401 | Missing / invalid / expired token |
| 403 | Wrong role, wrong restaurant for this token, or the restaurant is suspended |
| 404 | Unknown restaurant slug, or a record that does not belong to this tenant |

All errors share the shape `{ "message": "..." }`.
