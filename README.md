```markdown
# Hotel Management System

Riyon Hotel Management System is a **restaurant/hotel management web application** that allows customers to place food orders digitally from their tables and helps the restaurant detect **potential food allergies**. The system also provides a simple inventory and table management system for restaurant staff.

## Features

- Table-based customer login.
- Optional allergy input for customers.
- Menu browsing and food ordering.
- Automatic allergy detection for ordered dishes.
- Simple order status tracking: `pending → preparing → served`.
- Basic ingredient inventory management.
- Table status tracking: free / occupied.
- Dashboard for restaurant staff to view orders, allergy alerts, ingredients, and tables.
- Role-based access: **admin, manager, user**.

## Technology Stack

- **Backend:** Node.js, Express.js  
- **Database:** MongoDB, Mongoose  
- **ORM (optional):** TypeORM  
- **Containerization:** Docker & Docker Compose  
- **Environment Management:** dotenv  

## Folder Structure

```

hotel-management-backend/
│
├── server.js             # Entry point
├── app.js                # Express app initialization
├── config/
│   └── db.js             # MongoDB connection
│
├── entities/             # Database models
│   ├── user.entity.js
│   ├── table.entity.js
│   ├── dish.entity.js
│   ├── ingredient.entity.js
│   └── order.entity.js
│
├── routers/              # API routes
│   ├── user.routes.js
│   └── restaurant.routes.js
│
├── controllers/          # Handles incoming requests
│   ├── user.controller.js
│   └── restaurant.controller.js
│
├── services/             # Business logic
│   ├── user.service.js
│   └── restaurant.service.js
│
├── utils/                # Helper functions
│   └── allergyChecker.js
│
└── .env                  # Environment variables

````

## Installation

1. **Clone the repository**

```bash
git clone https://github.com/yourusername/riyonhotel.git
cd riyonhotel
````

2. **Install dependencies**

```bash
npm install
```

3. **Create `.env` file** (example)

```env
PORT=5000
MONGO_URI=mongodb://mongo:27017/hotel_management
JWT_SECRET=your_jwt_secret_key_here
NODE_ENV=development
```

## Running Locally

Start the server in **development mode**:

```bash
npm run dev
```

Start the server in **production mode**:

```bash
npm start
```

## Docker Setup

1. **Build and run using Docker Compose**

```bash
docker-compose up --build
```

2. This will start:

   * `backend` → Node.js application
   * `mongo` → MongoDB database

## API Endpoints

### User APIs

* `POST /user/login-table` → Log in with a table number
* `POST /user/set-allergies` → Enter allergies
* `GET /user/menu` → Retrieve menu
* `POST /user/order` → Place an order
* `POST /user/clear-table` → Clear the table after dining

### Restaurant APIs

* `GET /restaurant/orders` → View all orders
* `POST /restaurant/order-status` → Update order status
* `GET /restaurant/alerts` → View allergy alerts
* `POST /restaurant/add-ingredient` → Add ingredient to inventory
* `GET /restaurant/ingredients` → View ingredient inventory
* `GET /restaurant/tables` → View table status

## Allergy Detection

The backend automatically checks if any ingredient in a dish matches the customer’s allergy input. If a match is found, an `allergyAlert` flag is added to the order, which is visible only on the **restaurant dashboard**.

Example:

```json
{
  "tableNo": 5,
  "dishes": ["dishId1"],
  "allergiesInput": ["peanut"]
}
```

Response:

```json
{
  "message": "Order placed",
  "allergyAlert": true,
  "matchedIngredient": "peanut oil"
}
```

## Future Enhancements

* AI-powered allergy detection for cross-ingredient analysis.
* Real-time updates on dashboard using WebSockets.
* JWT-based authentication for staff and admin roles.
* Advanced inventory tracking and notifications for low stock or expiring ingredients.

```

---

If you want, I can also **add a small “Getting Started with Docker” section with commands** directly in the README so it’s fully copy-paste ready for development.  

Do you want me to do that?
```
