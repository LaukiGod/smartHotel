# Hotel Management System — Backend

QR-based in-restaurant ordering and management system.  
Customers order via QR scan. Staff manage orders. Admin manages everything.

---

## Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js v5
- **Database:** MongoDB + Mongoose
- **Auth:** Google OAuth2 (Passport.js) + JWT
- **AI:** Google Generative AI (allergy checker)

---

## Folder Structure

```
hotelManagementSystem/
├── app.js                        # Express app setup
├── server.js                     # Entry point
├── config/
│   ├── database.js               # MongoDB connection
│   └── passport.js               # Google OAuth2 strategy
├── entities/                     # Mongoose models
│   ├── user.entity.js            # Customer (table session)
│   ├── staff.entity.js           # Admin / Staff
│   ├── table.entity.js
│   ├── order.entity.js
│   ├── dish.entity.js
│   └── inventory.entity.js
├── controllers/
│   ├── user.controller.js
│   ├── restaurant.controller.js
│   └── staffAuth.controller.js
├── services/
│   ├── user.service.js
│   └── restaurant.service.js
├── routes/
│   ├── user.routes.js
│   ├── restaurant.routes.js
│   └── staffAuth.routes.js
├── middlewares/
│   └── staffAuth.middleware.js   # JWT authenticate + role authorize
└── utils/
    ├── jwt.js
    ├── allergyChecker.js
    ├── helpers.js
    ├── ingredientsManipulator.js
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
cp .env.example .env
```

Fill in `.env` (see Environment Variables section below).

### 3. Google OAuth2 setup

1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → **APIs & Services** → **Credentials** → **Create OAuth 2.0 Client ID**
3. Application type: **Web application**
4. Authorized redirect URI: `http://localhost:5000/api/auth/google/callback`
5. Copy **Client ID** and **Client Secret** into `.env`

### 4. Run

```bash
# Development
npm run dev

# Production
npm start
```

---

## Environment Variables

| Variable | Description |
|---|---|
| `PORT` | Server port (default: 5000) |
| `MONGO_URI` | MongoDB connection string |
| `GOOGLE_CLIENT_ID` | From Google Cloud Console |
| `GOOGLE_CLIENT_SECRET` | From Google Cloud Console |
| `GOOGLE_CALLBACK_URL` | Must match what's set in Google Console |
| `JWT_SECRET` | Long random string for signing tokens |
| `JWT_EXPIRES_IN` | Token expiry e.g. `8h`, `1d` |
| `FRONTEND_URL` | Where to redirect after login (e.g. `http://localhost:3000`) |

---

## Authentication Flow (Staff / Admin)

```
Admin pre-registers staff email+role via POST /api/auth/staff
          ↓
Staff opens GET /api/auth/google in browser
          ↓
Google login page → staff signs in
          ↓
Google redirects to /api/auth/google/callback
          ↓
Backend issues JWT → redirects to FRONTEND_URL/auth/callback?token=...
          ↓
Frontend stores token → sends as Authorization: Bearer <token> on all requests
```

> **First Admin:** Pre-register the first ADMIN directly in MongoDB, or temporarily open the `POST /api/auth/staff` route, create the admin, then re-protect it.

---

## API Reference

Base URL: `http://localhost:5000/api`

### Auth — `/api/auth`

| Method | Endpoint | Auth | Description |
|---|---|---|---|
| GET | `/auth/google` | Public | Redirect to Google login |
| GET | `/auth/google/callback` | Public | Google callback — issues JWT |
| GET | `/auth/failed` | Public | Login failure response |
| GET | `/auth/me` | Any staff | Get own token payload |
| GET | `/auth/staff` | ADMIN | List all staff |
| POST | `/auth/staff` | ADMIN | Pre-register a staff member |
| PATCH | `/auth/staff/:id/activate` | ADMIN | Activate staff account |
| PATCH | `/auth/staff/:id/deactivate` | ADMIN | Deactivate staff account |
| DELETE | `/auth/staff/:id` | ADMIN | Hard delete staff account |

**POST `/auth/staff` body:**
```json
{
  "name": "Riya Sharma",
  "email": "riya@restaurant.com",
  "role": "STAFF"
}
```

---

### Customer — `/api/user`

All public (no auth required).

| Method | Endpoint | Description |
|---|---|---|
| POST | `/user/login-table` | Start table session (name + phone) |
| POST | `/user/set-allergies` | Set customer allergies |
| GET | `/user/menu` | Get full menu |
| POST | `/user/order` | Place an order |
| POST | `/user/clear-table` | End session, free table |

**POST `/user/login-table` body:**
```json
{ "tableNo": 5, "name": "Amit", "phoneNo": "9876543210" }
```

**POST `/user/order` body:**
```json
{ "tableNo": 5, "dishes": ["<dishId>", "<dishId>"] }
```

---

### Restaurant — `/api/restaurant`

All require `Authorization: Bearer <token>` except `/tables`.

| Method | Endpoint | Role | Description |
|---|---|---|---|
| GET | `/restaurant/orders` | ADMIN, STAFF | All orders |
| POST | `/restaurant/order-status` | ADMIN, STAFF | Update order status |
| GET | `/restaurant/alerts` | ADMIN, STAFF | Active allergy alerts |
| GET | `/restaurant/tables` | Public | All table statuses |
| GET | `/restaurant/inventory` | ADMIN, STAFF | View inventory |
| POST | `/restaurant/add-inventory` | ADMIN | Add inventory items |
| PUT | `/restaurant/inventory/:id` | ADMIN | Update inventory item |
| DELETE | `/restaurant/inventory/:id` | ADMIN | Delete inventory item |
| POST | `/restaurant/add-dish` | ADMIN | Add a dish |
| PUT | `/restaurant/update-dish` | ADMIN | Update a dish |
| DELETE | `/restaurant/dish/:id` | ADMIN | Delete a dish |

**POST `/restaurant/order-status` body:**
```json
{ "orderId": "<id>", "status": "preparing" }
```
Valid statuses: `pending` → `preparing` → `served`

**POST `/restaurant/add-dish` body:**
```json
{
  "name": "Paneer Butter Masala",
  "price": 180,
  "ingredients": ["paneer", "butter", "tomato"],
  "recipe": "...",
  "imageUrl": "https://..."
}
```

---

## Order & Table Flows

```
Order:  created → pending → preparing → served
Table:  free → occupied → free
```

---

## Role Summary

| Role | Can Do |
|---|---|
| ADMIN | Everything: manage staff, dishes, inventory, orders |
| STAFF | View and update orders, view alerts and inventory, view tables |
| Customer | Login, view menu, place order, clear table (no auth token) |

---

## Protecting Routes (usage pattern)

```js
const { authenticate, authorize } = require("../middlewares/staffAuth.middleware");

router.get("/orders",    authenticate, authorize("ADMIN", "STAFF"), controller.getOrders);
router.post("/add-dish", authenticate, authorize("ADMIN"),          controller.addDish);
```

---

## Docker

```bash
docker-compose up --build
```