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

  CREATE TABLE IF NOT EXISTS billing_accounts (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    name TEXT NOT NULL,
    type TEXT NOT NULL CHECK(type IN ('PayPal', 'Stripe')),
    email TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
  );

  CREATE TABLE IF NOT EXISTS transfers (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    billing_account_id INTEGER NOT NULL REFERENCES billing_accounts(id),
    amount REAL NOT NULL,
    commission REAL NOT NULL,
    total_deducted REAL NOT NULL,
    date TEXT NOT NULL,
    service TEXT NOT NULL,
    tracking TEXT,
    comment TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
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
  `ALTER TABLE orders ADD COLUMN status TEXT NOT NULL DEFAULT 'open'`,
  `ALTER TABLE orders ADD COLUMN cad_amount REAL`,
  `ALTER TABLE orders ADD COLUMN commission REAL`,
  `ALTER TABLE orders ADD COLUMN net_amount REAL`,
  `ALTER TABLE orders ADD COLUMN confirmed_billing_account_id INTEGER REFERENCES billing_accounts(id)`,
  `ALTER TABLE transfers ADD COLUMN amount_pkr REAL`,
  `ALTER TABLE orders ADD COLUMN handler_id INTEGER REFERENCES users(id)`,
  `CREATE TABLE IF NOT EXISTS item_types (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT UNIQUE NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS handler_commissions (id INTEGER PRIMARY KEY AUTOINCREMENT, handler_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE, item_type_id INTEGER NOT NULL REFERENCES item_types(id) ON DELETE CASCADE, amount_pkr REAL NOT NULL DEFAULT 0, UNIQUE(handler_user_id, item_type_id))`,
  `CREATE TABLE IF NOT EXISTS handler_bills (id INTEGER PRIMARY KEY AUTOINCREMENT, handler_user_id INTEGER NOT NULL REFERENCES users(id), order_id INTEGER REFERENCES orders(id), order_number INTEGER, item_type TEXT, shipping_cost_pkr REAL NOT NULL DEFAULT 0, manufacturing_cost_pkr REAL NOT NULL DEFAULT 0, commission_pkr REAL NOT NULL DEFAULT 0, total_pkr REAL NOT NULL DEFAULT 0, note TEXT, date TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS handler_payments (id INTEGER PRIMARY KEY AUTOINCREMENT, handler_user_id INTEGER NOT NULL REFERENCES users(id), amount_pkr REAL NOT NULL, date TEXT NOT NULL, note TEXT, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS app_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS storenvy_accounts (id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, api_key TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now')))`,
];
for (const sql of migrations) {
  try { db.exec(sql); } catch { /* already exists */ }
}

// Safely migrate users table to support all roles + is_active
// Only runs if the current users table is missing the handler role or is_active column
try {
  const cols = db.prepare('PRAGMA table_info(users)').all().map(c => c.name);
  const needsMigration = !cols.includes('is_active');
  if (needsMigration) {
    db.exec(`
      CREATE TABLE IF NOT EXISTS users_v2 (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        username TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        role TEXT NOT NULL CHECK(role IN ('admin','deo','editor','handler')),
        is_active INTEGER NOT NULL DEFAULT 1
      );
      INSERT OR IGNORE INTO users_v2 (id, username, password_hash, role, is_active)
        SELECT id, username, password_hash, role, 1 FROM users;
      DROP TABLE IF EXISTS users;
      ALTER TABLE users_v2 RENAME TO users;
    `);
    console.log('Users table migrated to v2');
  }
} catch (e) { console.error('Users migration error:', e.message); }

// Seed default users if they don't exist
const bcrypt = require('bcryptjs');
const seedUsers = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'deo', password: 'deo123', role: 'deo' },
  { username: 'editor', password: 'editor123', role: 'editor' },
];
const insertUser = db.prepare('INSERT OR IGNORE INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)');
for (const u of seedUsers) {
  insertUser.run(u.username, bcrypt.hashSync(u.password, 10), u.role);
}

// Seed default item types
const seedItemTypes = ['Dress Shoes','Loafers','Cowboy Boot','Oxford Shoes','Oxford / Dress Shoes','Leather Shoes','Jacket'];
const insertItemType = db.prepare('INSERT OR IGNORE INTO item_types (name) VALUES (?)');
for (const name of seedItemTypes) insertItemType.run(name);

module.exports = db;
