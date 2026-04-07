const express = require('express');
const { db } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── Handler self-view ──
router.get('/my/dashboard', async (req, res) => {
  if (req.user.role !== 'handler' && req.user.role !== 'admin') {
    return res.status(403).json({ error: 'Forbidden' });
  }
  const handlerId = req.user.id;

  const ordersRes = await db.execute({
    sql: `SELECT orders.*, u.username as handler_username
          FROM orders LEFT JOIN users u ON orders.handler_id = u.id
          WHERE orders.handler_id = ? ORDER BY orders.order_number DESC`,
    args: [handlerId],
  });

  const billsRes    = await db.execute({ sql: 'SELECT * FROM handler_bills WHERE handler_user_id = ? ORDER BY date DESC', args: [handlerId] });
  const paymentsRes = await db.execute({ sql: 'SELECT * FROM handler_payments WHERE handler_user_id = ? ORDER BY date DESC', args: [handlerId] });

  const bills    = billsRes.rows;
  const payments = paymentsRes.rows;
  const totalBilled = bills.reduce((s, b) => s + (b.total_pkr || 0), 0);
  const totalPaid   = payments.reduce((s, p) => s + (p.amount_pkr || 0), 0);

  res.json({ orders: ordersRes.rows, bills, payments, totalBilled, totalPaid, balance: totalPaid - totalBilled });
});

router.use(requireRole('admin'));

// ── Handler list with billing summary ──
router.get('/', async (req, res) => {
  const handlersRes = await db.execute(`SELECT id, username, is_active FROM users WHERE role = 'handler' ORDER BY username ASC`);
  const handlers = handlersRes.rows;

  const commissionsRes   = await db.execute(`SELECT hc.handler_user_id, hc.item_type_id, hc.amount_pkr, it.name as item_type_name FROM handler_commissions hc JOIN item_types it ON hc.item_type_id = it.id`);
  const billsRes         = await db.execute('SELECT handler_user_id, total_pkr FROM handler_bills');
  const paymentsRes      = await db.execute('SELECT handler_user_id, amount_pkr FROM handler_payments');
  const assignedOrdersRes = await db.execute('SELECT handler_id, id FROM orders WHERE handler_id IS NOT NULL');

  const commissions   = commissionsRes.rows;
  const bills         = billsRes.rows;
  const payments      = paymentsRes.rows;
  const assignedOrders = assignedOrdersRes.rows;

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
router.put('/:id/commissions', async (req, res) => {
  const { id } = req.params;
  const handlerRes = await db.execute({ sql: `SELECT id FROM users WHERE id = ? AND role = 'handler'`, args: [id] });
  if (!handlerRes.rows[0]) return res.status(404).json({ error: 'Handler not found' });

  const { commissions } = req.body;
  if (!Array.isArray(commissions)) return res.status(400).json({ error: 'commissions must be an array' });

  for (const c of commissions) {
    await db.execute({
      sql: `INSERT INTO handler_commissions (handler_user_id, item_type_id, amount_pkr) VALUES (?, ?, ?)
            ON CONFLICT(handler_user_id, item_type_id) DO UPDATE SET amount_pkr = excluded.amount_pkr`,
      args: [parseInt(id), parseInt(c.item_type_id), parseFloat(c.amount_pkr) || 0],
    });
  }

  const result = await db.execute({
    sql: `SELECT hc.*, it.name as item_type_name FROM handler_commissions hc
          JOIN item_types it ON hc.item_type_id = it.id WHERE hc.handler_user_id = ?`,
    args: [id],
  });
  res.json(result.rows);
});

// ── Handler balance ──
router.get('/:id/balance', async (req, res) => {
  const { id } = req.params;
  const handlerRes = await db.execute({ sql: `SELECT id, username FROM users WHERE id = ? AND role = 'handler'`, args: [id] });
  if (!handlerRes.rows[0]) return res.status(404).json({ error: 'Handler not found' });

  const billsRes    = await db.execute({ sql: 'SELECT * FROM handler_bills WHERE handler_user_id = ? ORDER BY date DESC', args: [id] });
  const paymentsRes = await db.execute({ sql: 'SELECT * FROM handler_payments WHERE handler_user_id = ? ORDER BY date DESC', args: [id] });
  const ordersRes   = await db.execute({ sql: 'SELECT id, order_number, date, customer, shoes_type, status FROM orders WHERE handler_id = ? ORDER BY order_number DESC', args: [id] });

  const bills    = billsRes.rows;
  const payments = paymentsRes.rows;
  const orders   = ordersRes.rows;

  const billedOrderIds = new Set(bills.filter(b => b.order_id).map(b => b.order_id));
  const ordersWithBillStatus = orders.map(o => ({ ...o, hasBill: billedOrderIds.has(o.id) }));

  const totalBilled = bills.reduce((s, b) => s + (b.total_pkr || 0), 0);
  const totalPaid   = payments.reduce((s, p) => s + (p.amount_pkr || 0), 0);

  res.json({ handler: handlerRes.rows[0], orders: ordersWithBillStatus, bills, payments, totalBilled, totalPaid, balance: totalPaid - totalBilled });
});

// ── Add bill ──
router.post('/:id/bills', async (req, res) => {
  const { id } = req.params;
  const handlerRes = await db.execute({ sql: `SELECT id FROM users WHERE id = ? AND role = 'handler'`, args: [id] });
  if (!handlerRes.rows[0]) return res.status(404).json({ error: 'Handler not found' });

  const { order_id, order_number, item_type, shipping_cost_pkr, manufacturing_cost_pkr, commission_pkr, note, date } = req.body;
  if (!date) return res.status(400).json({ error: 'date is required' });

  const ship  = parseFloat(shipping_cost_pkr) || 0;
  const mfg   = parseFloat(manufacturing_cost_pkr) || 0;
  const comm  = parseFloat(commission_pkr) || 0;
  const total = ship + mfg + comm;

  const result = await db.execute({
    sql: `INSERT INTO handler_bills (handler_user_id, order_id, order_number, item_type, shipping_cost_pkr, manufacturing_cost_pkr, commission_pkr, total_pkr, note, date)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [parseInt(id), order_id || null, order_number || null, item_type || null, ship, mfg, comm, total, note || null, date],
  });
  const created = await db.execute({ sql: 'SELECT * FROM handler_bills WHERE id = ?', args: [result.lastInsertRowid] });
  res.status(201).json(created.rows[0]);
});

// ── Delete bill ──
router.delete('/:id/bills/:billId', async (req, res) => {
  const billRes = await db.execute({ sql: 'SELECT * FROM handler_bills WHERE id = ? AND handler_user_id = ?', args: [req.params.billId, req.params.id] });
  if (!billRes.rows[0]) return res.status(404).json({ error: 'Bill not found' });
  await db.execute({ sql: 'DELETE FROM handler_bills WHERE id = ?', args: [req.params.billId] });
  res.json({ success: true });
});

// ── Record payment ──
router.post('/:id/payments', async (req, res) => {
  const { id } = req.params;
  const handlerRes = await db.execute({ sql: `SELECT id FROM users WHERE id = ? AND role = 'handler'`, args: [id] });
  if (!handlerRes.rows[0]) return res.status(404).json({ error: 'Handler not found' });

  const { amount_pkr, date, note } = req.body;
  if (!amount_pkr || !date) return res.status(400).json({ error: 'amount_pkr and date are required' });

  const result = await db.execute({
    sql: 'INSERT INTO handler_payments (handler_user_id, amount_pkr, date, note) VALUES (?, ?, ?, ?)',
    args: [parseInt(id), parseFloat(amount_pkr), date, note || null],
  });
  const created = await db.execute({ sql: 'SELECT * FROM handler_payments WHERE id = ?', args: [result.lastInsertRowid] });
  res.status(201).json(created.rows[0]);
});

// ── Delete payment ──
router.delete('/:id/payments/:paymentId', async (req, res) => {
  const paymentRes = await db.execute({ sql: 'SELECT * FROM handler_payments WHERE id = ? AND handler_user_id = ?', args: [req.params.paymentId, req.params.id] });
  if (!paymentRes.rows[0]) return res.status(404).json({ error: 'Payment not found' });
  await db.execute({ sql: 'DELETE FROM handler_payments WHERE id = ?', args: [req.params.paymentId] });
  res.json({ success: true });
});

module.exports = router;
