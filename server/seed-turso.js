// seed-turso.js — seeds existing data into Turso
// Run once: TURSO_URL=... TURSO_AUTH_TOKEN=... node seed-turso.js

const { createClient } = require('@libsql/client');
const bcrypt = require('bcryptjs');

const db = createClient({
  url: process.env.TURSO_URL,
  authToken: process.env.TURSO_AUTH_TOKEN,
});

async function seed() {
  console.log('Seeding Turso database...');

  // ── Users ──
  const users = [
    { username: 'admin',     password: 'admin123',  role: 'admin',   is_active: 1 },
    { username: 'deo',       password: 'deo123',    role: 'deo',     is_active: 1 },
    { username: 'editor',    password: 'editor123', role: 'editor',  is_active: 1 },
    { username: 'waseem',    password: 'waseem123', role: 'handler', is_active: 1 },
    { username: 'hammad',    password: 'hammad123', role: 'deo',     is_active: 1 },
    { username: 'waseem _a', password: 'waseem123', role: 'handler', is_active: 0 },
  ];
  for (const u of users) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, ?)',
      args: [u.username, bcrypt.hashSync(u.password, 10), u.role, u.is_active],
    });
  }
  console.log('✓ Users');

  // ── Billing accounts ──
  const billingAccounts = [
    { id: 1, name: 'Hamza',            type: 'PayPal',  email: 'hamza@gmail.com',   created_at: '2026-04-03 08:56:44' },
    { id: 2, name: 'Hamza Strip UHML', type: 'Stripe',  email: 'hamza@gmailc.om',   created_at: '2026-04-03 08:57:11' },
  ];
  for (const b of billingAccounts) {
    await db.execute({
      sql: 'INSERT OR IGNORE INTO billing_accounts (id, name, type, email, created_at) VALUES (?, ?, ?, ?, ?)',
      args: [b.id, b.name, b.type, b.email, b.created_at],
    });
  }
  console.log('✓ Billing accounts');

  // ── Orders ──
  // Look up waseem's actual ID since autoincrement may differ
  const waseemRes = await db.execute({ sql: `SELECT id FROM users WHERE username = 'waseem'`, args: [] });
  const waseemId = waseemRes.rows[0]?.id || null;

  const orders = [
    { order_number: 3990, date: '2026-03-01', customer: 'Sultan Hindawi',           store_ref: '21923738', quantity: 1, source: 'UHMLS',      shoes_type: 'Dress Shoes',        country: 'Ukraine', size: '9.5',  color: 'Brown',          status: 'open',          order_amount: null,   payment_method: null,    shipping_address: null,                                              image_path: null, confirmed_billing_account_id: null, handler_id: null },
    { order_number: 3991, date: '2026-03-01', customer: 'Sultan Hindawi',           store_ref: '21923738', quantity: 1, source: 'UHMLS',      shoes_type: 'Dress Shoes',        country: 'Ukraine', size: '9.5',  color: 'Brown',          status: 'open',          order_amount: null,   payment_method: null,    shipping_address: null,                                              image_path: null, confirmed_billing_account_id: null, handler_id: null },
    { order_number: 3992, date: '2026-03-01', customer: 'Sultan Hindawi',           store_ref: '21923738', quantity: 1, source: 'UHMLS',      shoes_type: 'Dress Shoes',        country: 'Ukraine', size: '9.5',  color: 'Black',          status: 'dispute_opened', order_amount: null,  payment_method: null,    shipping_address: null,                                              image_path: null, confirmed_billing_account_id: null, handler_id: null },
    { order_number: 3993, date: '2026-03-01', customer: 'Sultan Hindawi',           store_ref: '21923738', quantity: 1, source: 'UHMLS',      shoes_type: 'Dress Shoes',        country: 'Ukraine', size: '9.5',  color: 'Black',          status: 'open',          order_amount: null,   payment_method: null,    shipping_address: null,                                              image_path: null, confirmed_billing_account_id: null, handler_id: null },
    { order_number: 3994, date: '2026-03-11', customer: 'Peter Williams',           store_ref: '21925645', quantity: 1, source: 'TLH',        shoes_type: 'Loafers',            country: 'US',      size: '12.5', color: 'Green',          status: 'open',          order_amount: null,   payment_method: null,    shipping_address: null,                                              image_path: null, confirmed_billing_account_id: null, handler_id: null },
    { order_number: 3995, date: '2026-03-11', customer: 'Babacar Sy',               store_ref: '21926018', quantity: 2, source: 'TLH',        shoes_type: 'Oxford / Dress Shoes', country: 'US',    size: '11.5', color: 'Maroon / Brown', status: 'open',          order_amount: null,   payment_method: null,    shipping_address: null,                                              image_path: null, confirmed_billing_account_id: null, handler_id: null },
    { order_number: 3996, date: '2026-03-12', customer: 'Kevin Chanik',             store_ref: '21926281', quantity: 1, source: 'TLH',        shoes_type: 'Cowboy Boot',        country: 'US',      size: '11',   color: 'Black',          status: 'open',          order_amount: null,   payment_method: null,    shipping_address: null,                                              image_path: null, confirmed_billing_account_id: null, handler_id: null },
    { order_number: 3997, date: '2026-03-16', customer: 'James Carter',             store_ref: '21927125', quantity: 1, source: 'TLH',        shoes_type: 'Loafers',            country: 'US',      size: '9.5',  color: 'Brown',          status: 'open',          order_amount: null,   payment_method: null,    shipping_address: null,                                              image_path: null, confirmed_billing_account_id: null, handler_id: null },
    { order_number: 3998, date: '2026-03-20', customer: 'Panagiotis Angelopoulos',  store_ref: '21927857', quantity: 1, source: 'TLH',        shoes_type: 'Loafers',            country: 'Greece',  size: '9',    color: 'Dark Brown',     status: 'processing',    order_amount: 200.0,  payment_method: 'Stripe',  shipping_address: 'my new addres is not saving',                    image_path: null, confirmed_billing_account_id: 1,    handler_id: waseemId },
    { order_number: 3999, date: '2026-03-25', customer: 'Curtis Young',             store_ref: '21929284', quantity: 1, source: 'Lajuria',    shoes_type: 'Loafers',            country: 'US',      size: '9.5',  color: 'Brown',          status: 'processing',    order_amount: null,   payment_method: null,    shipping_address: null,                                              image_path: null, confirmed_billing_account_id: null, handler_id: waseemId },
    { order_number: 4000, date: '2026-03-31', customer: 'Eugene Tensley',           store_ref: '21930532', quantity: 1, source: 'Lajuria',    shoes_type: 'Leather Shoes',      country: 'US',      size: '10',   color: 'Black',          status: 'processing',    order_amount: 224.0,  payment_method: 'Stripe',  shipping_address: null,                                              image_path: null, confirmed_billing_account_id: 1,    handler_id: waseemId },
    { order_number: 4001, date: '2026-02-05', customer: 'George E Bowers Jr',       store_ref: '21918291', quantity: 1, source: 'Store Envy', shoes_type: "Men's Attractive Color Navy Blue Suede Jodhpurs Buckle Fashion Boot Handmade Edition", country: 'US', size: '8.5', color: 'N/A', status: 'open', order_amount: 184.97, payment_method: 'stripe', shipping_address: '4115 18th Avenue North, St. Petersburg, Florida, 33713, US', image_path: null, confirmed_billing_account_id: null, handler_id: null },
  ];

  for (const o of orders) {
    await db.execute({
      sql: `INSERT OR IGNORE INTO orders
              (order_number, date, customer, store_ref, quantity, source, shoes_type, country, size, color,
               status, order_amount, payment_method, shipping_address, image_path, confirmed_billing_account_id, handler_id)
            VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
      args: [o.order_number, o.date, o.customer, o.store_ref, o.quantity, o.source, o.shoes_type, o.country, o.size, o.color,
             o.status, o.order_amount, o.payment_method, o.shipping_address, o.image_path, o.confirmed_billing_account_id, o.handler_id],
    });
  }
  console.log('✓ Orders (12)');

  console.log('\nDone! Turso database seeded.');
  process.exit(0);
}

seed().catch(err => { console.error(err); process.exit(1); });
