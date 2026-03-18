Sure! I’ll create a **simple and structured API documentation** for your current Riyon Hotel Management System backend. This will be **REST API-focused**, easy to follow, and ready to include in your docs or README.

---

# Riyon Hotel Management System – API Documentation

Base URL (local development):

```
http://localhost:5000/api
```

All requests and responses use **JSON** format.

---

## **User APIs (Customer)**

### 1. Login Table

**Endpoint:** `POST /api/user/login-table`
**Description:** Customer logs in using their table number. Marks table as occupied.

**Request Body:**

```json
{
  "tableNo": 5
}
```

**Response:**

```json
{
  "message": "Table 5 logged in successfully",
  "tableNo": 5,
  "status": "occupied"
}
```

---

### 2. Set Allergies

**Endpoint:** `POST /api/user/set-allergies`
**Description:** Customer enters their allergies (optional).

**Request Body:**

```json
{
  "tableNo": 5,
  "allergies": ["peanut", "milk"]
}
```

**Response:**

```json
{
  "message": "Allergies saved successfully",
  "tableNo": 5,
  "allergies": ["peanut", "milk"]
}
```

---

### 3. Get Menu

**Endpoint:** `GET /api/user/menu`
**Description:** Retrieve the list of available dishes. **Ingredients are hidden.**

**Response:**

```json
[
  {
    "dishId": "64f9c12345678",
    "name": "Grilled Chicken",
    "price": 12.5
  },
  {
    "dishId": "64f9c98765432",
    "name": "Veggie Salad",
    "price": 8.0
  }
]
```

---

### 4. Place Order

**Endpoint:** `POST /api/user/order`
**Description:** Place an order for one or more dishes. Allergy detection is performed automatically.

**Request Body:**

```json
{
  "tableNo": 5,
  "dishes": ["64f9c12345678", "64f9c98765432"]
}
```

**Response (No Allergy):**

```json
{
  "message": "Order placed successfully",
  "orderId": "64fa1a56789",
  "allergyAlert": false
}
```

**Response (With Allergy Alert):**

```json
{
  "message": "Order placed successfully",
  "orderId": "64fa1a56789",
  "allergyAlert": true,
  "matchedIngredients": ["peanut oil"]
}
```

---

### 5. Clear Table

**Endpoint:** `POST /api/user/clear-table`
**Description:** Clear table after the customer leaves. Marks table as free.

**Request Body:**

```json
{
  "tableNo": 5
}
```

**Response:**

```json
{
  "message": "Table 5 cleared successfully",
  "status": "free"
}
```

---

## **Restaurant APIs (Staff / Admin)**

### 1. Get All Orders

**Endpoint:** `GET /api/restaurant/orders`
**Description:** Retrieve all orders with their status and allergy alerts.

**Response:**

```json
[
  {
    "orderId": "64fa1a56789",
    "tableNo": 5,
    "dishes": ["Grilled Chicken", "Veggie Salad"],
    "status": "pending",
    "allergyAlert": true,
    "matchedIngredients": ["peanut oil"]
  }
]
```

---

### 2. Update Order Status

**Endpoint:** `POST /api/restaurant/order-status`
**Description:** Update the status of an order (`pending`, `preparing`, `served`).

**Request Body:**

```json
{
  "orderId": "64fa1a56789",
  "status": "preparing"
}
```

**Response:**

```json
{
  "message": "Order status updated successfully",
  "orderId": "64fa1a56789",
  "status": "preparing"
}
```

---

### 3. Get Allergy Alerts

**Endpoint:** `GET /api/restaurant/alerts`
**Description:** Retrieve all orders that contain allergy alerts.

**Response:**

```json
[
  {
    "orderId": "64fa1a56789",
    "tableNo": 5,
    "dishes": ["Grilled Chicken"],
    "matchedIngredients": ["peanut oil"]
  }
]
```

---

### 4. Add Ingredient

**Endpoint:** `POST /api/restaurant/add-ingredient`
**Description:** Add a new ingredient to the inventory.

**Request Body:**

```json
{
  "name": "Peanut Oil",
  "quantity": 5,
  "expiryDate": "2026-09-30"
}
```

**Response:**

```json
{
  "message": "Ingredient added successfully",
  "ingredient": {
    "name": "Peanut Oil",
    "quantity": 5,
    "expiryDate": "2026-09-30"
  }
}
```

---

### 5. Get Ingredients

**Endpoint:** `GET /api/restaurant/ingredients`
**Description:** Retrieve all ingredients in inventory.

**Response:**

```json
[
  {
    "name": "Peanut Oil",
    "quantity": 5,
    "expiryDate": "2026-09-30",
    "isExpired": false
  }
]
```

---

### 6. Get Table Status

**Endpoint:** `GET /api/restaurant/tables`
**Description:** Retrieve status of all tables (free/occupied).

**Response:**

```json
[
  {
    "tableNo": 1,
    "status": "free"
  },
  {
    "tableNo": 5,
    "status": "occupied"
  }
]
```
