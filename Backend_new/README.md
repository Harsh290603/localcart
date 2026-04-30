# 🛒 LocalCart Backend — Setup Guide

A complete Node.js + Express + MongoDB backend for the LocalCart frontend.

---

## ⚡ Quick Start (3 steps)

```bash
# 1. Install dependencies
npm install

# 2. Create your .env file
cp .env.example .env
# (Edit .env if you want to change MONGO_URI or PORT)

# 3. Start the server
npm start
```

Server starts at → **http://localhost:5000**

---

## 📋 Prerequisites

| Tool | Version | Install |
|------|---------|---------|
| Node.js | ≥ 16 | https://nodejs.org |
| MongoDB | ≥ 6 (local) | https://www.mongodb.com/try/download/community |

> **Tip:** If you prefer a cloud database, use [MongoDB Atlas](https://www.mongodb.com/atlas) (free tier) and paste the connection string into `.env`.

---

## 📁 Project Structure

```
localcart-backend/
├── server.js          ← Main server (all routes in one file)
├── package.json
├── .env.example       ← Copy this to .env
├── .gitignore
├── uploads/           ← Auto-created; stores uploaded images
└── README.md
```

---

## 🔌 API Reference

### Auth
| Method | Route | Body | Description |
|--------|-------|------|-------------|
| POST | `/signup` | `{username, email, password, role}` | Register new user |
| POST | `/login` | `{email, password}` | Login existing user |

**role** can be `"customer"` or `"business"`.

---

### Image Upload
| Method | Route | Form Field | Description |
|--------|-------|------------|-------------|
| POST | `/api/upload` | `shopImage` (single file) | Upload shop banner image |
| POST | `/api/upload-multiple` | `productImages` (multiple files) | Upload product images (max 10) |

Response: `{ success: true, imageUrl: "http://..." }` or `{ imageUrls: [...] }`

---

### Shop Management
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/shop-setup` | Create or update shop details & live status |
| GET | `/api/get-shop-all/:email` | Get shop info + all its products |
| GET | `/api/all-shops` | Get all **live** shops (for marketplace) |

**POST /api/shop-setup body:**
```json
{
  "ownerEmail": "owner@example.com",
  "name": "My Shop",
  "phone": "9876543210",
  "dealIn": "Electronics",
  "address": "123 Main St, Bhopal",
  "image": "https://...",
  "isLive": true
}
```
All fields except `ownerEmail` are optional — only provided fields are updated.

---

### Product Management
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/add-product` | Add a new product to a shop |
| POST | `/api/update-product` | Update existing product details |
| POST | `/api/toggle-stock` | Toggle in-stock / out-of-stock |
| DELETE | `/api/delete-product/:id` | Delete a product (also removes images) |

---

### Orders
| Method | Route | Description |
|--------|-------|-------------|
| POST | `/api/place-order` | Customer places an order |
| GET | `/api/my-orders/:email` | Customer's own order history |
| GET | `/api/owner-orders/:email` | Business owner sees orders for their shop |
| POST | `/api/update-order-status` | Mark order as `completed` |

**POST /api/place-order body:**
```json
{
  "customerName": "Rahul Sharma",
  "customerEmail": "rahul@example.com",
  "customerPhone": "9876543210",
  "customerAddress": "House No 12, Gandhi Nagar, Bhopal",
  "items": [
    { "_id": "...", "name": "T-Shirt", "price": 499, "qty": 2, "shopEmail": "shop@example.com", "shopName": "Trendy Threads" }
  ],
  "totalAmount": 1038,
  "status": "Pending"
}
```

---

## 🔧 Development Mode (auto-restart on save)

```bash
npm run dev
```
Requires `nodemon` (installed automatically as a dev dependency).

---

## 🗄️ MongoDB Atlas (Cloud DB) Setup

1. Go to [mongodb.com/atlas](https://www.mongodb.com/atlas) → create free cluster
2. Click **Connect** → **Drivers** → copy connection string
3. Open `.env` and replace `MONGO_URI` with your Atlas string:
   ```
   MONGO_URI=mongodb+srv://youruser:yourpass@cluster0.abc123.mongodb.net/localcart
   ```
4. Whitelist your IP in Atlas → **Network Access → Add IP**

---

## 🚀 Deployment (Railway / Render / Heroku)

1. Push this folder to a GitHub repo
2. On your platform, set environment variable:
   - `MONGO_URI` = your Atlas connection string
   - `PORT` = (usually set automatically)
3. Build command: `npm install`
4. Start command: `npm start`

---

## 🛡️ Security Notes

- Passwords are hashed with **bcryptjs** (salt rounds = 10)
- File uploads are validated for image MIME type
- CORS is open (`*`) for development — restrict to your domain in production:
  ```js
  app.use(cors({ origin: 'https://yourdomain.com' }));
  ```

---

## 📦 Tech Stack

| Package | Purpose |
|---------|---------|
| express | HTTP server & routing |
| mongoose | MongoDB ODM |
| bcryptjs | Password hashing |
| cors | Cross-origin requests |
| multer | File/image uploads |
| dotenv | Environment variables |
