# OMS — Order Management System

A full-stack web application for managing footwear and apparel orders with multi-role access, handler billing, and Store Envy integration.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Frontend | React 19, Vite, React Router, Axios, Recharts |
| Backend | Node.js, Express 4 |
| Database | SQLite (better-sqlite3) |
| Auth | JWT (8-hour expiry) + bcrypt |
| Image Storage | Cloudinary |
| Image Capture | html2canvas |

---

## Project Structure

```
OMS/
├── server/                  # Express backend
│   ├── index.js             # Entry point
│   ├── db.js                # Schema, migrations, seed data
│   ├── middleware/auth.js   # JWT + role enforcement
│   ├── routes/              # auth, orders, billing, handlers, settings, …
│   └── uploads/             # Local upload fallback
└── client/                  # React + Vite frontend
    └── src/
        ├── pages/           # Admin / DEO / Editor / Handler views
        └── components/      # Shared UI (OrderForm, OrderCard, Sidebar, …)
```

---

## Prerequisites

- Node.js 18+
- npm 9+
- A free [Cloudinary](https://cloudinary.com) account (for image uploads)

---

## Local Setup

### 1. Clone the repo

```bash
git clone https://github.com/NafeesAhmedAbbasi/OMS.git
cd OMS
```

### 2. Install dependencies

```bash
npm run install:all
```

This installs both server and client dependencies in one command.

### 3. Configure environment variables

Create a `.env` file inside the `server/` directory:

```
# server/.env

PORT=3011
JWT_SECRET=your-secret-key-change-in-production

CLOUDINARY_CLOUD_NAME=your-cloud-name
CLOUDINARY_API_KEY=your-api-key
CLOUDINARY_API_SECRET=your-api-secret
```

> The database (`server/db.sqlite`) is created automatically on first run — no setup needed.

### 4. Start the server

```bash
# Terminal 1
npm run server
```

Server runs at `http://localhost:3011`

### 5. Start the client

```bash
# Terminal 2
npm run client
```

Client runs at `http://localhost:5180`

### 6. Open the app

Go to `http://localhost:5180/login` and log in with one of the default accounts below.

---

## Default Accounts

| Username | Password | Role |
|---|---|---|
| `admin` | `admin123` | Admin |
| `deo` | `deo123` | DEO |
| `editor` | `editor123` | Editor |

> Change these passwords immediately in production.

---

## User Roles

### Admin
Full system access:
- Create and manage users (activate/deactivate, reset passwords)
- Assign orders to handlers
- Configure handler commission rates per item type
- Manage item types
- Configure Store Envy accounts (API keys)

### DEO (Data Entry Operator)
- Create orders manually
- Import orders from Store Envy with a review step before import
- View and edit existing orders
- Generate and share order cards via WhatsApp

### Editor
- Confirm orders (set CAD amount, commission, billing account)
- Manage billing accounts (PayPal / Stripe)
- Record transfers
- Manage order statuses (open → confirmed / dispute)

### Handler
- View personally assigned orders
- View billing breakdown (shipping + manufacturing + commission per order)
- Track balance (total billed vs total paid)

---

## Key Features

- **Order lifecycle** — open → processing → confirmed → dispute / cancelled
- **Store Envy integration** — link multiple accounts, fetch orders, auto-map fields, auto-fetch product images, review and edit each order before importing
- **Handler billing** — per-order bills (shipping + mfg + commission), payment recording, balance tracking
- **Order card** — generates a printable card with product image; shareable directly to WhatsApp
- **Delayed order detection** — flags orders not shipped within 14 days
- **Role-based UI** — each role sees only relevant pages and data

---

## Available Scripts

From the project root:

| Script | Description |
|---|---|
| `npm run server` | Start the Express backend |
| `npm run client` | Start the Vite dev server |
| `npm run install:all` | Install all dependencies (server + client) |
| `npm run seed` | Seed the database with sample orders |

---

## API Overview

All API routes are prefixed with `/api`.

| Method | Path | Role | Description |
|---|---|---|---|
| POST | `/api/auth/login` | Public | Login |
| GET | `/api/orders` | Any | List all orders |
| POST | `/api/orders` | DEO | Create order |
| PUT | `/api/orders/:id` | DEO/Editor | Update order |
| PUT | `/api/orders/:id/assign` | Admin | Assign handler |
| PUT | `/api/orders/:id/confirm` | Editor | Confirm order |
| GET | `/api/handlers` | Admin | List handlers with billing summary |
| GET | `/api/handlers/my/dashboard` | Handler | Personal dashboard |
| GET | `/api/settings/storenvy-accounts` | Any | List Store Envy accounts |
| GET | `/api/settings/storenvy-accounts/:id/orders` | Any | Fetch orders from Store Envy |

---

## Database

SQLite database is stored at `server/db.sqlite`. It is created and migrated automatically on server startup — no manual migration step needed.

The following tables are created automatically:

- `users`
- `orders`
- `billing_accounts`
- `transfers`
- `item_types`
- `handler_commissions`
- `handler_bills`
- `handler_payments`
- `app_settings`
- `storenvy_accounts`

---

## Production Notes

- Set a strong `JWT_SECRET` in your environment
- Cloudinary credentials are required for image upload to work
- Branch protection on `main` is recommended — require PR + approval before merging
- The SQLite file (`db.sqlite`) should be backed up regularly; it is excluded from version control via `.gitignore`
