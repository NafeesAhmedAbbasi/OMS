const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function init() {
  // ── Core tables ──
  await db.executeMultiple(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      username TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('admin','deo','editor','handler')),
      is_active INTEGER NOT NULL DEFAULT 1
    );

    CREATE TABLE IF NOT EXISTS billing_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      type TEXT NOT NULL CHECK(type IN ('PayPal','Stripe')),
      email TEXT NOT NULL,
      opening_balance REAL NOT NULL DEFAULT 0,
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      amount_pkr REAL
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
      created_at TEXT NOT NULL DEFAULT (datetime('now')),
      order_amount REAL,
      payment_method TEXT,
      shipping_address TEXT,
      status TEXT NOT NULL DEFAULT 'open',
      cad_amount REAL,
      commission REAL,
      net_amount REAL,
      confirmed_billing_account_id INTEGER REFERENCES billing_accounts(id),
      handler_id INTEGER REFERENCES users(id)
    );

    CREATE TABLE IF NOT EXISTS item_types (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS handler_commissions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handler_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      item_type_id INTEGER NOT NULL REFERENCES item_types(id) ON DELETE CASCADE,
      amount_pkr REAL NOT NULL DEFAULT 0,
      UNIQUE(handler_user_id, item_type_id)
    );

    CREATE TABLE IF NOT EXISTS handler_bills (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handler_user_id INTEGER NOT NULL REFERENCES users(id),
      order_id INTEGER REFERENCES orders(id),
      order_number INTEGER,
      item_type TEXT,
      shipping_cost_pkr REAL NOT NULL DEFAULT 0,
      manufacturing_cost_pkr REAL NOT NULL DEFAULT 0,
      commission_pkr REAL NOT NULL DEFAULT 0,
      total_pkr REAL NOT NULL DEFAULT 0,
      note TEXT,
      date TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS handler_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handler_user_id INTEGER NOT NULL REFERENCES users(id),
      amount_pkr REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS app_settings (
      key TEXT PRIMARY KEY,
      value TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS storenvy_accounts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      api_key TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS handler_commission_rates (
      handler_user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      rate_per_unit_pkr REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS handler_opening_balances (
      handler_user_id INTEGER PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
      amount_pkr REAL NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS order_cost_overrides (
      handler_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      manufacturing_cost_pkr REAL NOT NULL DEFAULT 0,
      shipping_cost_pkr REAL NOT NULL DEFAULT 0,
      commission_pkr REAL NOT NULL DEFAULT 0,
      PRIMARY KEY (handler_user_id, order_id)
    );

    CREATE TABLE IF NOT EXISTS handler_workers (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handler_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      role TEXT NOT NULL CHECK(role IN ('manufacturer','shipper')),
      is_active INTEGER NOT NULL DEFAULT 1,
      opening_balance_pkr REAL NOT NULL DEFAULT 0,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_worker_assignments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL REFERENCES orders(id) ON DELETE CASCADE,
      worker_id INTEGER NOT NULL REFERENCES handler_workers(id) ON DELETE CASCADE,
      role TEXT NOT NULL CHECK(role IN ('manufacturer','shipper')),
      rate_per_unit_pkr REAL NOT NULL DEFAULT 0,
      UNIQUE(order_id, role)
    );

    CREATE TABLE IF NOT EXISTS worker_payments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      worker_id INTEGER NOT NULL REFERENCES handler_workers(id) ON DELETE CASCADE,
      handler_user_id INTEGER NOT NULL REFERENCES users(id),
      amount_pkr REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS handler_misc_charges (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      handler_user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      description TEXT NOT NULL,
      amount_pkr REAL NOT NULL,
      date TEXT NOT NULL,
      note TEXT,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS order_sources (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT UNIQUE NOT NULL,
      created_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  // ── Migrations: add columns to existing tables if missing ──
  try {
    await db.execute('ALTER TABLE billing_accounts ADD COLUMN opening_balance REAL NOT NULL DEFAULT 0');
  } catch { /* column already exists */ }
  try {
    await db.execute('ALTER TABLE handler_workers ADD COLUMN opening_balance_pkr REAL NOT NULL DEFAULT 0');
  } catch { /* column already exists */ }

  // ── Seed default users ──
  const seedUsers = [
    { username: 'admin',  password: 'admin123',  role: 'admin' },
    { username: 'deo',    password: 'deo123',    role: 'deo' },
    { username: 'editor', password: 'editor123', role: 'editor' },
  ];
  for (const u of seedUsers) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)',
      args: [u.username, bcrypt.hashSync(u.password, 10), u.role],
    });
  }

  // ── Seed default item types ──
  const seedItemTypes = ['Dress Shoes','Loafers','Cowboy Boot','Oxford Shoes','Oxford / Dress Shoes','Leather Shoes','Jacket'];
  for (const name of seedItemTypes) {
    await db.execute({ sql: 'INSERT OR IGNORE INTO item_types (name) VALUES (?)', args: [name] });
  }

  // ── Seed default order sources ──
  const seedSources = ['TLH', 'Lajuria', 'UHMLS', 'Store Envy'];
  for (const name of seedSources) {
    await db.execute({ sql: 'INSERT OR IGNORE INTO order_sources (name) VALUES (?)', args: [name] });
  }

  console.log('Database initialised');
}

module.exports = { db, init };
