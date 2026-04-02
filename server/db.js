const Database = require('better-sqlite3');
const path = require('path');

const db = new Database(path.join(__dirname, 'db.sqlite'));

db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    username TEXT UNIQUE NOT NULL,
    password_hash TEXT NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('admin', 'deo'))
  );

  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    order_number INTEGER UNIQUE NOT NULL,
    date TEXT NOT NULL,
    customer TEXT NOT NULL,
    store_ref TEXT,
    mc_pkr REAL,
    sc_pkr REAL,
    quantity INTEGER NOT NULL DEFAULT 1,
    tracking TEXT,
    source TEXT NOT NULL,
    shoes_type TEXT NOT NULL,
    country TEXT NOT NULL,
    size TEXT NOT NULL,
    color TEXT NOT NULL,
    comments TEXT,
    image_path TEXT,
    shipping_service TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

// Migrate existing databases — safe to ignore if column already exists
const migrations = [
  `ALTER TABLE orders ADD COLUMN shipping_service TEXT`,
  `ALTER TABLE orders ADD COLUMN order_amount REAL`,
  `ALTER TABLE orders ADD COLUMN payment_method TEXT`,
  `ALTER TABLE orders ADD COLUMN shipping_address TEXT`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* already exists */ }
}

module.exports = db;
