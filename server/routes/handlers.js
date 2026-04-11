const express = require('express');
const { db } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── Auth helper: handler can only access their own data, admin can access all ──
function requireHandlerOrAdmin(req, res, paramId) {
  const id = parseInt(paramId);
  if (req.user.role !== 'admin' && req.user.id !== id) {
    res.status(403).json({ error: 'Forbidden' });
    return false;
  }
  return true;
}

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

  const billsRes       = await db.execute({ sql: 'SELECT * FROM handler_bills WHERE handler_user_id = ? ORDER BY date DESC', args: [handlerId] });
  const paymentsRes    = await db.execute({ sql: 'SELECT * FROM handler_payments WHERE handler_user_id = ? ORDER BY date DESC', args: [handlerId] });
  const workersRes     = await db.execute({ sql: 'SELECT * FROM handler_workers WHERE handler_user_id = ? ORDER BY name ASC', args: [handlerId] });
  const miscRes        = await db.execute({ sql: 'SELECT * FROM handler_misc_charges WHERE handler_user_id = ? ORDER BY date DESC', args: [handlerId] });
  const commRateRes    = await db.execute({ sql: 'SELECT rate_per_unit_pkr FROM handler_commission_rates WHERE handler_user_id = ?', args: [handlerId] });

  // Assignments for all orders of this handler
  const orderIds = ordersRes.rows.map(o => o.id);
  let assignments = [];
  if (orderIds.length > 0) {
    const assignRes = await db.execute({
      sql: `SELECT owa.*, hw.name as worker_name FROM order_worker_assignments owa
            JOIN handler_workers hw ON owa.worker_id = hw.id
            WHERE owa.order_id IN (${orderIds.map(() => '?').join(',')})`,
      args: orderIds,
    });
    assignments = assignRes.rows;
  }

  // Worker payment summaries
  const workerPayRes = await db.execute({
    sql: 'SELECT worker_id, SUM(amount_pkr) as total_paid FROM worker_payments WHERE handler_user_id = ? GROUP BY worker_id',
    args: [handlerId],
  });
  const workerPayMap = {};
  for (const wp of workerPayRes.rows) workerPayMap[wp.worker_id] = wp.total_paid || 0;

  // Worker owed = sum of (rate × quantity) for all assignments
  const workerOwedRes = await db.execute({
    sql: `SELECT owa.worker_id, SUM(owa.rate_per_unit_pkr * o.quantity) as total_owed
          FROM order_worker_assignments owa
          JOIN orders o ON owa.order_id = o.id
          WHERE o.handler_id = ?
          GROUP BY owa.worker_id`,
    args: [handlerId],
  });
  const workerOwedMap = {};
  for (const wo of workerOwedRes.rows) workerOwedMap[wo.worker_id] = wo.total_owed || 0;

  const bills    = billsRes.rows;
  const payments = paymentsRes.rows;
  const totalBilled = bills.reduce((s, b) => s + (b.total_pkr || 0), 0);
  const totalPaid   = payments.reduce((s, p) => s + (p.amount_pkr || 0), 0);
  const totalMisc   = miscRes.rows.reduce((s, m) => s + (m.amount_pkr || 0), 0);
  const commissionRate = commRateRes.rows[0]?.rate_per_unit_pkr || 0;

  const workers = workersRes.rows.map(w => ({
    ...w,
    total_owed: workerOwedMap[w.id] || 0,
    total_paid: workerPayMap[w.id] || 0,
    balance: (workerOwedMap[w.id] || 0) - (workerPayMap[w.id] || 0),
  }));

  res.json({
    orders: ordersRes.rows,
    bills,
    payments,
    totalBilled,
    totalPaid,
    balance: totalPaid - totalBilled,
    workers,
    assignments,
    miscCharges: miscRes.rows,
    totalMisc,
    commissionRate,
  });
});

// ── Workers: list (handler or admin) ──
router.get('/:id/workers', async (req, res) => {
  if (!requireHandlerOrAdmin(req, res, req.params.id)) return;
  const workersRes = await db.execute({
    sql: 'SELECT * FROM handler_workers WHERE handler_user_id = ? ORDER BY role ASC, name ASC',
    args: [parseInt(req.params.id)],
  });

  // Attach balance summaries
  const workerIds = workersRes.rows.map(w => w.id);
  let owedMap = {}, paidMap = {};
  if (workerIds.length > 0) {
    const owedRes = await db.execute({
      sql: `SELECT owa.worker_id, SUM(owa.rate_per_unit_pkr * o.quantity) as total_owed
            FROM order_worker_assignments owa
            JOIN orders o ON owa.order_id = o.id
            WHERE owa.worker_id IN (${workerIds.map(() => '?').join(',')})
            GROUP BY owa.worker_id`,
      args: workerIds,
    });
    for (const r of owedRes.rows) owedMap[r.worker_id] = r.total_owed || 0;

    const paidRes = await db.execute({
      sql: `SELECT worker_id, SUM(amount_pkr) as total_paid FROM worker_payments
            WHERE worker_id IN (${workerIds.map(() => '?').join(',')})
            GROUP BY worker_id`,
      args: workerIds,
    });
    for (const r of paidRes.rows) paidMap[r.worker_id] = r.total_paid || 0;
  }

  res.json(workersRes.rows.map(w => ({
    ...w,
    total_owed: owedMap[w.id] || 0,
    total_paid: paidMap[w.id] || 0,
    balance: (owedMap[w.id] || 0) - (paidMap[w.id] || 0),
  })));
});

// ── Workers: create (handler or admin) ──
router.post('/:id/workers', async (req, res) => {
  if (!requireHandlerOrAdmin(req, res, req.params.id)) return;
  const handlerId = parseInt(req.params.id);
  const { name, role } = req.body;
  if (!name || !role) return res.status(400).json({ error: 'name and role are required' });
  if (!['manufacturer', 'shipper'].includes(role)) return res.status(400).json({ error: 'role must be manufacturer or shipper' });

  const result = await db.execute({
    sql: 'INSERT INTO handler_workers (handler_user_id, name, role) VALUES (?, ?, ?)',
    args: [handlerId, name.trim(), role],
  });
  const created = await db.execute({ sql: 'SELECT * FROM handler_workers WHERE id = ?', args: [result.lastInsertRowid] });
  res.status(201).json({ ...created.rows[0], total_owed: 0, total_paid: 0, balance: 0 });
});

// ── Workers: update (handler or admin) ──
router.put('/:id/workers/:wid', async (req, res) => {
  if (!requireHandlerOrAdmin(req, res, req.params.id)) return;
  const workerRes = await db.execute({
    sql: 'SELECT * FROM handler_workers WHERE id = ? AND handler_user_id = ?',
    args: [req.params.wid, parseInt(req.params.id)],
  });
  if (!workerRes.rows[0]) return res.status(404).json({ error: 'Worker not found' });

  const { name, is_active } = req.body;
  const updates = [];
  const args = [];
  if (name !== undefined)      { updates.push('name = ?');      args.push(name.trim()); }
  if (is_active !== undefined) { updates.push('is_active = ?'); args.push(is_active ? 1 : 0); }
  if (updates.length === 0) return res.status(400).json({ error: 'No fields to update' });

  args.push(req.params.wid);
  await db.execute({ sql: `UPDATE handler_workers SET ${updates.join(', ')} WHERE id = ?`, args });
  const updated = await db.execute({ sql: 'SELECT * FROM handler_workers WHERE id = ?', args: [req.params.wid] });
  res.json(updated.rows[0]);
});

// ── Workers: delete (deactivate) (handler or admin) ──
router.delete('/:id/workers/:wid', async (req, res) => {
  if (!requireHandlerOrAdmin(req, res, req.params.id)) return;
  const workerRes = await db.execute({
    sql: 'SELECT * FROM handler_workers WHERE id = ? AND handler_user_id = ?',
    args: [req.params.wid, parseInt(req.params.id)],
  });
  if (!workerRes.rows[0]) return res.status(404).json({ error: 'Worker not found' });
  await db.execute({ sql: 'DELETE FROM handler_workers WHERE id = ?', args: [req.params.wid] });
  res.json({ success: true });
});

// ── Order worker assignments: get for an order (handler or admin) ──
router.get('/:id/orders/:oid/assignment', async (req, res) => {
  if (!requireHandlerOrAdmin(req, res, req.params.id)) return;
  const result = await db.execute({
    sql: `SELECT owa.*, hw.name as worker_name FROM order_worker_assignments owa
          JOIN handler_workers hw ON owa.worker_id = hw.id
          WHERE owa.order_id = ?`,
    args: [parseInt(req.params.oid)],
  });
  res.json(result.rows);
});

// ── Order worker assignments: upsert (handler or admin) ──
router.post('/:id/orders/:oid/assignment', async (req, res) => {
  if (!requireHandlerOrAdmin(req, res, req.params.id)) return;
  const orderId = parseInt(req.params.oid);
  const handlerId = parseInt(req.params.id);

  // Verify order belongs to handler
  const orderRes = await db.execute({
    sql: 'SELECT id, quantity FROM orders WHERE id = ? AND handler_id = ?',
    args: [orderId, handlerId],
  });
  if (!orderRes.rows[0]) return res.status(404).json({ error: 'Order not found for this handler' });

  const { manufacturer_id, manufacturer_rate, shipper_id, shipper_rate } = req.body;

  if (manufacturer_id !== undefined && manufacturer_id !== null) {
    const rate = parseFloat(manufacturer_rate) || 0;
    await db.execute({
      sql: `INSERT INTO order_worker_assignments (order_id, worker_id, role, rate_per_unit_pkr)
            VALUES (?, ?, 'manufacturer', ?)
            ON CONFLICT(order_id, role) DO UPDATE SET worker_id = excluded.worker_id, rate_per_unit_pkr = excluded.rate_per_unit_pkr`,
      args: [orderId, parseInt(manufacturer_id), rate],
    });
  }

  if (shipper_id !== undefined && shipper_id !== null) {
    const rate = parseFloat(shipper_rate) || 0;
    await db.execute({
      sql: `INSERT INTO order_worker_assignments (order_id, worker_id, role, rate_per_unit_pkr)
            VALUES (?, ?, 'shipper', ?)
            ON CONFLICT(order_id, role) DO UPDATE SET worker_id = excluded.worker_id, rate_per_unit_pkr = excluded.rate_per_unit_pkr`,
      args: [orderId, parseInt(shipper_id), rate],
    });
  }

  const result = await db.execute({
    sql: `SELECT owa.*, hw.name as worker_name FROM order_worker_assignments owa
          JOIN handler_workers hw ON owa.worker_id = hw.id
          WHERE owa.order_id = ?`,
    args: [orderId],
  });
  res.json(result.rows);
});

// ── Order worker assignments: remove one role (handler or admin) ──
router.delete('/:id/orders/:oid/assignment/:role', async (req, res) => {
  if (!requireHandlerOrAdmin(req, res, req.params.id)) return;
  const role = req.params.role;
  if (!['manufacturer', 'shipper'].includes(role)) return res.status(400).json({ error: 'Invalid role' });
  await db.execute({
    sql: 'DELETE FROM order_worker_assignments WHERE order_id = ? AND role = ?',
    args: [parseInt(req.params.oid), role],
  });
  res.json({ success: true });
});

// ── Worker payments: list (handler or admin) ──
router.get('/:id/workers/:wid/payments', async (req, res) => {
  if (!requireHandlerOrAdmin(req, res, req.params.id)) return;
  const result = await db.execute({
    sql: 'SELECT * FROM worker_payments WHERE worker_id = ? ORDER BY date DESC',
    args: [parseInt(req.params.wid)],
  });
  res.json(result.rows);
});

// ── Worker payments: add (handler or admin) ──
router.post('/:id/workers/:wid/payments', async (req, res) => {
  if (!requireHandlerOrAdmin(req, res, req.params.id)) return;
  const handlerId = parseInt(req.params.id);
  const workerId  = parseInt(req.params.wid);

  // Verify worker belongs to handler
  const workerRes = await db.execute({
    sql: 'SELECT id FROM handler_workers WHERE id = ? AND handler_user_id = ?',
    args: [workerId, handlerId],
  });
  if (!workerRes.rows[0]) return res.status(404).json({ error: 'Worker not found' });

  const { amount_pkr, date, note } = req.body;
  if (!amount_pkr || !date) return res.status(400).json({ error: 'amount_pkr and date are required' });

  const result = await db.execute({
    sql: 'INSERT INTO worker_payments (worker_id, handler_user_id, amount_pkr, date, note) VALUES (?, ?, ?, ?, ?)',
    args: [workerId, handlerId, parseFloat(amount_pkr), date, note || null],
  });
  const created = await db.execute({ sql: 'SELECT * FROM worker_payments WHERE id = ?', args: [result.lastInsertRowid] });
  res.status(201).json(created.rows[0]);
});

// ── Worker payments: delete (handler or admin) ──
router.delete('/:id/workers/:wid/payments/:pid', async (req, res) => {
  if (!requireHandlerOrAdmin(req, res, req.params.id)) return;
  const payRes = await db.execute({
    sql: 'SELECT * FROM worker_payments WHERE id = ? AND worker_id = ?',
    args: [req.params.pid, req.params.wid],
  });
  if (!payRes.rows[0]) return res.status(404).json({ error: 'Payment not found' });
  await db.execute({ sql: 'DELETE FROM worker_payments WHERE id = ?', args: [req.params.pid] });
  res.json({ success: true });
});

// ── Misc charges: list (handler or admin) ──
router.get('/:id/misc-charges', async (req, res) => {
  if (!requireHandlerOrAdmin(req, res, req.params.id)) return;
  const result = await db.execute({
    sql: 'SELECT * FROM handler_misc_charges WHERE handler_user_id = ? ORDER BY date DESC',
    args: [parseInt(req.params.id)],
  });
  res.json(result.rows);
});

// ── Misc charges: add (handler or admin) ──
router.post('/:id/misc-charges', async (req, res) => {
  if (!requireHandlerOrAdmin(req, res, req.params.id)) return;
  const { description, amount_pkr, date, note } = req.body;
  if (!description || !amount_pkr || !date) return res.status(400).json({ error: 'description, amount_pkr and date are required' });

  const result = await db.execute({
    sql: 'INSERT INTO handler_misc_charges (handler_user_id, description, amount_pkr, date, note) VALUES (?, ?, ?, ?, ?)',
    args: [parseInt(req.params.id), description.trim(), parseFloat(amount_pkr), date, note || null],
  });
  const created = await db.execute({ sql: 'SELECT * FROM handler_misc_charges WHERE id = ?', args: [result.lastInsertRowid] });
  res.status(201).json(created.rows[0]);
});

// ── Misc charges: delete (handler or admin) ──
router.delete('/:id/misc-charges/:cid', async (req, res) => {
  if (!requireHandlerOrAdmin(req, res, req.params.id)) return;
  const chargeRes = await db.execute({
    sql: 'SELECT * FROM handler_misc_charges WHERE id = ? AND handler_user_id = ?',
    args: [req.params.cid, req.params.id],
  });
  if (!chargeRes.rows[0]) return res.status(404).json({ error: 'Charge not found' });
  await db.execute({ sql: 'DELETE FROM handler_misc_charges WHERE id = ?', args: [req.params.cid] });
  res.json({ success: true });
});

// ════════════════════════════════════════════════════════════════
// Admin-only routes below
// ════════════════════════════════════════════════════════════════
router.use(requireRole('admin'));

// ── Handler list with billing summary ──
router.get('/', async (req, res) => {
  const handlersRes = await db.execute(`SELECT id, username, is_active FROM users WHERE role = 'handler' ORDER BY username ASC`);
  const handlers = handlersRes.rows;

  const billsRes         = await db.execute('SELECT handler_user_id, total_pkr FROM handler_bills');
  const paymentsRes      = await db.execute('SELECT handler_user_id, amount_pkr FROM handler_payments');
  const assignedOrdersRes = await db.execute('SELECT handler_id, id FROM orders WHERE handler_id IS NOT NULL');
  const commRatesRes     = await db.execute('SELECT handler_user_id, rate_per_unit_pkr FROM handler_commission_rates');

  const bills         = billsRes.rows;
  const payments      = paymentsRes.rows;
  const assignedOrders = assignedOrdersRes.rows;
  const commRates     = commRatesRes.rows;

  res.json(handlers.map(h => {
    const hBills    = bills.filter(b => b.handler_user_id === h.id);
    const hPayments = payments.filter(p => p.handler_user_id === h.id);
    const totalBilled = hBills.reduce((s, b) => s + (b.total_pkr || 0), 0);
    const totalPaid   = hPayments.reduce((s, p) => s + (p.amount_pkr || 0), 0);
    const cr = commRates.find(r => r.handler_user_id === h.id);
    return {
      ...h,
      commissionRate: cr ? cr.rate_per_unit_pkr : 0,
      totalBilled,
      totalPaid,
      balance: totalPaid - totalBilled,
      assignedOrderCount: assignedOrders.filter(o => o.handler_id === h.id).length,
    };
  }));
});

// ── Save commission rate (single PKR/unit) ──
router.put('/:id/commission-rate', async (req, res) => {
  const { id } = req.params;
  const handlerRes = await db.execute({ sql: `SELECT id FROM users WHERE id = ? AND role = 'handler'`, args: [id] });
  if (!handlerRes.rows[0]) return res.status(404).json({ error: 'Handler not found' });

  const { rate_per_unit_pkr } = req.body;
  const rate = parseFloat(rate_per_unit_pkr) || 0;

  await db.execute({
    sql: `INSERT INTO handler_commission_rates (handler_user_id, rate_per_unit_pkr) VALUES (?, ?)
          ON CONFLICT(handler_user_id) DO UPDATE SET rate_per_unit_pkr = excluded.rate_per_unit_pkr`,
    args: [parseInt(id), rate],
  });
  res.json({ handler_user_id: parseInt(id), rate_per_unit_pkr: rate });
});

// ── Handler balance (admin view) ──
router.get('/:id/balance', async (req, res) => {
  const { id } = req.params;
  const handlerRes = await db.execute({ sql: `SELECT id, username FROM users WHERE id = ? AND role = 'handler'`, args: [id] });
  if (!handlerRes.rows[0]) return res.status(404).json({ error: 'Handler not found' });

  const billsRes       = await db.execute({ sql: 'SELECT * FROM handler_bills WHERE handler_user_id = ? ORDER BY date DESC', args: [id] });
  const paymentsRes    = await db.execute({ sql: 'SELECT * FROM handler_payments WHERE handler_user_id = ? ORDER BY date DESC', args: [id] });
  const ordersRes      = await db.execute({ sql: 'SELECT id, order_number, date, customer, shoes_type, quantity, status FROM orders WHERE handler_id = ? ORDER BY order_number DESC', args: [id] });
  const workersRes     = await db.execute({ sql: 'SELECT * FROM handler_workers WHERE handler_user_id = ? ORDER BY role ASC, name ASC', args: [id] });
  const miscRes        = await db.execute({ sql: 'SELECT * FROM handler_misc_charges WHERE handler_user_id = ? ORDER BY date DESC', args: [id] });
  const commRateRes    = await db.execute({ sql: 'SELECT rate_per_unit_pkr FROM handler_commission_rates WHERE handler_user_id = ?', args: [id] });

  const bills    = billsRes.rows;
  const payments = paymentsRes.rows;
  const orders   = ordersRes.rows;

  // Assignments for all orders
  const orderIds = orders.map(o => o.id);
  let assignments = [];
  if (orderIds.length > 0) {
    const assignRes = await db.execute({
      sql: `SELECT owa.*, hw.name as worker_name FROM order_worker_assignments owa
            JOIN handler_workers hw ON owa.worker_id = hw.id
            WHERE owa.order_id IN (${orderIds.map(() => '?').join(',')})`,
      args: orderIds,
    });
    assignments = assignRes.rows;
  }

  const billedOrderIds = new Set(bills.filter(b => b.order_id).map(b => b.order_id));
  const ordersWithStatus = orders.map(o => ({ ...o, hasBill: billedOrderIds.has(o.id) }));

  // Worker balances
  const workerIds = workersRes.rows.map(w => w.id);
  let owedMap = {}, paidMap = {};
  if (workerIds.length > 0) {
    const owedRes = await db.execute({
      sql: `SELECT owa.worker_id, SUM(owa.rate_per_unit_pkr * o.quantity) as total_owed
            FROM order_worker_assignments owa
            JOIN orders o ON owa.order_id = o.id
            WHERE owa.worker_id IN (${workerIds.map(() => '?').join(',')})
            GROUP BY owa.worker_id`,
      args: workerIds,
    });
    for (const r of owedRes.rows) owedMap[r.worker_id] = r.total_owed || 0;

    const paidRes = await db.execute({
      sql: `SELECT worker_id, SUM(amount_pkr) as total_paid FROM worker_payments
            WHERE worker_id IN (${workerIds.map(() => '?').join(',')})
            GROUP BY worker_id`,
      args: workerIds,
    });
    for (const r of paidRes.rows) paidMap[r.worker_id] = r.total_paid || 0;
  }
  const workers = workersRes.rows.map(w => ({
    ...w,
    total_owed: owedMap[w.id] || 0,
    total_paid: paidMap[w.id] || 0,
    balance: (owedMap[w.id] || 0) - (paidMap[w.id] || 0),
  }));

  const totalBilled = bills.reduce((s, b) => s + (b.total_pkr || 0), 0);
  const totalPaid   = payments.reduce((s, p) => s + (p.amount_pkr || 0), 0);
  const totalMisc   = miscRes.rows.reduce((s, m) => s + (m.amount_pkr || 0), 0);

  res.json({
    handler: handlerRes.rows[0],
    orders: ordersWithStatus,
    bills,
    payments,
    totalBilled,
    totalPaid,
    balance: totalPaid - totalBilled,
    workers,
    assignments,
    miscCharges: miscRes.rows,
    totalMisc,
    commissionRate: commRateRes.rows[0]?.rate_per_unit_pkr || 0,
  });
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

// ── Record payment to handler ──
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
