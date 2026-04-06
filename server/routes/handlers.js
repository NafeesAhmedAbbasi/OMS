const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── Handler self-view (accessible by handler role) ──
router.get('/my/dashboard', (req, res) => {
  if (req.user.role !== 'handler' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const handlerId = req.user.id;

  const orders = db.prepare(`
    SELECT orders.*, u.username as handler_username
    FROM orders
    LEFT JOIN users u ON orders.handler_id = u.id
    WHERE orders.handler_id = ?
    ORDER BY orders.order_number DESC
  `).all(handlerId);

  let bills = [], payments = [];
  try { bills = db.prepare(`SELECT * FROM handler_bills WHERE handler_user_id = ? ORDER BY date DESC`).all(handlerId); } catch {}
  try { payments = db.prepare(`SELECT * FROM handler_payments WHERE handler_user_id = ? ORDER BY date DESC`).all(handlerId); } catch {}

  const totalBilled = bills.reduce((s, b) => s + (b.total_pkr || 0), 0);
  const totalPaid   = payments.reduce((s, p) => s + (p.amount_pkr || 0), 0);

  res.json({ orders, bills, payments, totalBilled, totalPaid, balance: totalPaid - totalBilled });
});

router.use(requireRole('admin'));

// ── Handler list with commissions ──
router.get('/', (req, res) => {
  const handlers = db.prepare(
    `SELECT id, username, is_active FROM users WHERE role = 'handler' ORDER BY username ASC`
  ).all();

  let commissions = [], bills = [], payments = [], assignedOrders = [];
  try {
    commissions = db.prepare(
      `SELECT hc.handler_user_id, hc.item_type_id, hc.amount_pkr, it.name as item_type_name
       FROM handler_commissions hc JOIN item_types it ON hc.item_type_id = it.id`
    ).all();
  } catch {}
  try { bills    = db.prepare(`SELECT handler_user_id, total_pkr FROM handler_bills`).all(); } catch {}
  try { payments = db.prepare(`SELECT handler_user_id, amount_pkr FROM handler_payments`).all(); } catch {}
  try { assignedOrders = db.prepare(`SELECT handler_id, id FROM orders WHERE handler_id IS NOT NULL`).all(); } catch {}

  res.json(handlers.map(h => {
    const hBills    = bills.filter(b => b.handler_user_id === h.id);
    const hPayments = payments.filter(p => p.handler_user_id === h.id);
    const totalBilled = hBills.reduce((s, b) => s + (b.total_pkr || 0), 0);
    const totalPaid   = hPayments.reduce((s, p) => s + (p.amount_pkr || 0), 0);
    return {
      ...h,
      commissions: commissions.filter(c => c.handler_user_id === h.id),
      totalBilled,
      totalPaid,
      balance: totalPaid - totalBilled,
      assignedOrderCount: assignedOrders.filter(o => o.handler_id === h.id).length,
    };
  }));
});

// ── Save commissions ──
router.put('/:id/commissions', (req, res) => {
  const { id } = req.params;
  const handler = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'handler'`).get(id);
  if (!handler) return res.status(404).json({ error: 'Handler not found' });
  const { commissions } = req.body;
  if (!Array.isArray(commissions)) return res.status(400).json({ error: 'commissions must be an array' });
  const upsert = db.prepare(
    `INSERT INTO handler_commissions (handler_user_id, item_type_id, amount_pkr) VALUES (?, ?, ?)
     ON CONFLICT(handler_user_id, item_type_id) DO UPDATE SET amount_pkr = excluded.amount_pkr`
  );
  db.transaction(() => {
    for (const c of commissions) upsert.run(parseInt(id), parseInt(c.item_type_id), parseFloat(c.amount_pkr) || 0);
  })();
  res.json(db.prepare(
    `SELECT hc.*, it.name as item_type_name FROM handler_commissions hc
     JOIN item_types it ON hc.item_type_id = it.id WHERE hc.handler_user_id = ?`
  ).all(id));
});

// ── Handler balance summary ──
router.get('/:id/balance', (req, res) => {
  const { id } = req.params;
  const handler = db.prepare(`SELECT id, username FROM users WHERE id = ? AND role = 'handler'`).get(id);
  if (!handler) return res.status(404).json({ error: 'Handler not found' });

  let bills = [], payments = [], orders = [];
  try { bills = db.prepare(`SELECT * FROM handler_bills WHERE handler_user_id = ? ORDER BY date DESC`).all(id); } catch {}
  try { payments = db.prepare(`SELECT * FROM handler_payments WHERE handler_user_id = ? ORDER BY date DESC`).all(id); } catch {}
  try {
    orders = db.prepare(`SELECT id, order_number, date, customer, shoes_type, status FROM orders WHERE handler_id = ? ORDER BY order_number DESC`).all(id);
  } catch {}

  // Mark which orders already have a bill
  const billedOrderIds = new Set(bills.filter(b => b.order_id).map(b => b.order_id));
  const ordersWithBillStatus = orders.map(o => ({ ...o, hasBill: billedOrderIds.has(o.id) }));

  const totalBilled = bills.reduce((s, b) => s + (b.total_pkr || 0), 0);
  const totalPaid   = payments.reduce((s, p) => s + (p.amount_pkr || 0), 0);

  res.json({ handler, orders: ordersWithBillStatus, bills, payments, totalBilled, totalPaid, balance: totalPaid - totalBilled });
});

// ── Add bill for a handler ──
router.post('/:id/bills', (req, res) => {
  const { id } = req.params;
  const handler = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'handler'`).get(id);
  if (!handler) return res.status(404).json({ error: 'Handler not found' });

  const { order_id, order_number, item_type, shipping_cost_pkr, manufacturing_cost_pkr, commission_pkr, note, date } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required' });

  const ship = parseFloat(shipping_cost_pkr) || 0;
  const mfg  = parseFloat(manufacturing_cost_pkr) || 0;
  const comm = parseFloat(commission_pkr) || 0;
  const total = ship + mfg + comm;

  const result = db.prepare(
    `INSERT INTO handler_bills (handler_user_id, order_id, order_number, item_type, shipping_cost_pkr, manufacturing_cost_pkr, commission_pkr, total_pkr, note, date)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
  ).run(parseInt(id), order_id || null, order_number || null, item_type || null, ship, mfg, comm, total, note || null, date);

  res.status(201).json(db.prepare('SELECT * FROM handler_bills WHERE id = ?').get(result.lastInsertRowid));
});

// ── Delete a bill ──
router.delete('/:id/bills/:billId', (req, res) => {
  const bill = db.prepare('SELECT * FROM handler_bills WHERE id = ? AND handler_user_id = ?').get(req.params.billId, req.params.id);
  if (!bill) return res.status(404).json({ error: 'Bill not found' });
  db.prepare('DELETE FROM handler_bills WHERE id = ?').run(req.params.billId);
  res.json({ success: true });
});

// ── Record a payment to handler ──
router.post('/:id/payments', (req, res) => {
  const { id } = req.params;
  const handler = db.prepare(`SELECT id FROM users WHERE id = ? AND role = 'handler'`).get(id);
  if (!handler) return res.status(404).json({ error: 'Handler not found' });

  const { amount_pkr, date, note } = req.body;
  if (!amount_pkr || !date) return res.status(400).json({ error: 'amount_pkr and date are required' });

  const result = db.prepare(
    `INSERT INTO handler_payments (handler_user_id, amount_pkr, date, note) VALUES (?, ?, ?, ?)`
  ).run(parseInt(id), parseFloat(amount_pkr), date, note || null);

  res.status(201).json(db.prepare('SELECT * FROM handler_payments WHERE id = ?').get(result.lastInsertRowid));
});

// ── Delete a payment ──
router.delete('/:id/payments/:paymentId', (req, res) => {
  const payment = db.prepare('SELECT * FROM handler_payments WHERE id = ? AND handler_user_id = ?').get(req.params.paymentId, req.params.id);
  if (!payment) return res.status(404).json({ error: 'Payment not found' });
  db.prepare('DELETE FROM handler_payments WHERE id = ?').run(req.params.paymentId);
  res.json({ success: true });
});

module.exports = router;
