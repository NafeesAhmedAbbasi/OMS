const bcrypt = require('bcryptjs');
const db = require('./db');

// Seed users
const users = [
  { username: 'admin', password: 'admin123', role: 'admin' },
  { username: 'deo', password: 'deo123', role: 'deo' },
  { username: 'editor', password: 'editor123', role: 'editor' },
];

const insertUser = db.prepare(
  'INSERT OR IGNORE INTO users (username, password_hash, role) VALUES (?, ?, ?)'
);

for (const u of users) {
  const hash = bcrypt.hashSync(u.password, 10);
  insertUser.run(u.username, hash, u.role);
}
console.log('Users seeded.');

// Seed orders from spreadsheet data
const orders = [
  { order_number: 3990, date: '2026-03-01', customer: 'Sultan Hindawi', store_ref: '21923738', mc_pkr: null, sc_pkr: null, quantity: 1, tracking: null, source: 'UHMLS', shoes_type: 'Dress Shoes', country: 'Ukraine', size: '9.5', color: 'Brown', comments: null },
  { order_number: 3991, date: '2026-03-01', customer: 'Sultan Hindawi', store_ref: '21923738', mc_pkr: null, sc_pkr: null, quantity: 1, tracking: null, source: 'UHMLS', shoes_type: 'Dress Shoes', country: 'Ukraine', size: '9.5', color: 'Brown', comments: null },
  { order_number: 3992, date: '2026-03-01', customer: 'Sultan Hindawi', store_ref: '21923738', mc_pkr: null, sc_pkr: null, quantity: 1, tracking: null, source: 'UHMLS', shoes_type: 'Dress Shoes', country: 'Ukraine', size: '9.5', color: 'Black', comments: null },
  { order_number: 3993, date: '2026-03-01', customer: 'Sultan Hindawi', store_ref: '21923738', mc_pkr: null, sc_pkr: null, quantity: 1, tracking: null, source: 'UHMLS', shoes_type: 'Dress Shoes', country: 'Ukraine', size: '9.5', color: 'Black', comments: null },
  { order_number: 3994, date: '2026-03-11', customer: 'Peter Williams', store_ref: '21925645', mc_pkr: null, sc_pkr: null, quantity: 1, tracking: null, source: 'TLH', shoes_type: 'Loafers', country: 'US', size: '12.5', color: 'Green', comments: null },
  { order_number: 3995, date: '2026-03-11', customer: 'Babacar Sy', store_ref: '21926018', mc_pkr: null, sc_pkr: null, quantity: 2, tracking: null, source: 'TLH', shoes_type: 'Oxford / Dress Shoes', country: 'US', size: '11.5', color: 'Maroon / Brown', comments: null },
  { order_number: 3996, date: '2026-03-12', customer: 'Kevin Chanik', store_ref: '21926281', mc_pkr: null, sc_pkr: null, quantity: 1, tracking: null, source: 'TLH', shoes_type: 'Cowboy Boot', country: 'US', size: '11', color: 'Black', comments: null },
  { order_number: 3997, date: '2026-03-16', customer: 'James Carter', store_ref: '21927125', mc_pkr: null, sc_pkr: null, quantity: 1, tracking: null, source: 'TLH', shoes_type: 'Loafers', country: 'US', size: '9.5', color: 'Brown', comments: null },
  { order_number: 3998, date: '2026-03-20', customer: 'Panagiotis Angelopoulos', store_ref: '21927857', mc_pkr: null, sc_pkr: null, quantity: 1, tracking: null, source: 'TLH', shoes_type: 'Loafers', country: 'Greece', size: '9', color: 'Dark Brown', comments: null },
  { order_number: 3999, date: '2026-03-25', customer: 'Curtis Young', store_ref: '21929284', mc_pkr: null, sc_pkr: null, quantity: 1, tracking: null, source: 'Lajuria', shoes_type: 'Loafers', country: 'US', size: '9.5', color: 'Brown', comments: null },
  { order_number: 4000, date: '2026-03-31', customer: 'Eugene Tensley', store_ref: '21930532', mc_pkr: null, sc_pkr: null, quantity: 1, tracking: null, source: 'Lajuria', shoes_type: 'Leather Shoes', country: 'US', size: '10', color: 'Black', comments: null },
];

const insertOrder = db.prepare(`
  INSERT OR IGNORE INTO orders
    (order_number, date, customer, store_ref, mc_pkr, sc_pkr, quantity, tracking,
     source, shoes_type, country, size, color, comments)
  VALUES
    (@order_number, @date, @customer, @store_ref, @mc_pkr, @sc_pkr, @quantity, @tracking,
     @source, @shoes_type, @country, @size, @color, @comments)
`);

for (const o of orders) {
  insertOrder.run(o);
}
console.log(`Seeded ${orders.length} orders.`);
