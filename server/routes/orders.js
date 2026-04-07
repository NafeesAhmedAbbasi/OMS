const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const { db } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();

cloudinary.config({
  cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
  api_key: process.env.CLOUDINARY_API_KEY,
  api_secret: process.env.CLOUDINARY_API_SECRET,
});

const storage = new CloudinaryStorage({
  cloudinary,
  params: { folder: 'oms-orders', allowed_formats: ['jpg', 'jpeg', 'png', 'webp'] },
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authMiddleware);

router.get('/next-number', async (req, res) => {
  const result = await db.execute('SELECT MAX(order_number) as max FROM orders');
  const max = result.rows[0]?.max;
  res.json({ next: max ? max + 1 : 4001 });
});

router.get('/', async (req, res) => {
  const result = await db.execute(`
    SELECT orders.*, billing_accounts.name as billing_account_name,
           u.username as handler_username
    FROM orders
    LEFT JOIN billing_accounts ON orders.confirmed_billing_account_id = billing_accounts.id
    LEFT JOIN users u ON orders.handler_id = u.id
    ORDER BY orders.order_number DESC
  `);
  res.json(result.rows);
});

router.post('/', upload.single('image'), async (req, res) => {
  const {
    date, customer, store_ref, mc_pkr, sc_pkr, quantity,
    tracking, source, shoes_type, country, size, color,
    comments, shipping_service, order_amount, payment_method, shipping_address,
    order_number: order_number_input,
  } = req.body;

  if (!date || !customer || !source || !shoes_type || !country || !size || !color || !order_amount || !payment_method) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let order_number;
  if (order_number_input && parseInt(order_number_input) > 0) {
    order_number = parseInt(order_number_input);
    const existing = await db.execute({ sql: 'SELECT id FROM orders WHERE order_number = ?', args: [order_number] });
    if (existing.rows[0]) return res.status(409).json({ error: `Order #${order_number} already exists` });
  } else {
    const row = await db.execute('SELECT MAX(order_number) as max FROM orders');
    order_number = row.rows[0]?.max ? row.rows[0].max + 1 : 4001;
  }
  const image_path = req.file ? req.file.path : null;

  const result = await db.execute({
    sql: `INSERT INTO orders (order_number, date, customer, store_ref, mc_pkr, sc_pkr,
            quantity, tracking, source, shoes_type, country, size, color, comments,
            image_path, shipping_service, order_amount, payment_method, shipping_address)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [
      order_number, date, customer, store_ref || null,
      mc_pkr ? parseFloat(mc_pkr) : null,
      sc_pkr ? parseFloat(sc_pkr) : null,
      quantity ? parseInt(quantity) : 1,
      tracking || null, source, shoes_type, country, size, color,
      comments || null, image_path, shipping_service || null,
      parseFloat(order_amount), payment_method, shipping_address || null,
    ],
  });

  const created = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [result.lastInsertRowid] });
  res.status(201).json(created.rows[0]);
});

router.put('/:id', upload.single('image'), async (req, res) => {
  const { id } = req.params;
  const existingRes = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
  const existing = existingRes.rows[0];
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  const {
    date, customer, store_ref, mc_pkr, sc_pkr, quantity,
    tracking, source, shoes_type, country, size, color,
    comments, shipping_service, order_amount, payment_method, shipping_address,
  } = req.body;

  if (!date || !customer || !source || !shoes_type || !country || !size || !color || !order_amount || !payment_method) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const image_path = req.file ? req.file.path : existing.image_path;

  await db.execute({
    sql: `UPDATE orders SET
            date = ?, customer = ?, store_ref = ?, mc_pkr = ?, sc_pkr = ?,
            quantity = ?, tracking = ?, source = ?, shoes_type = ?, country = ?,
            size = ?, color = ?, comments = ?, image_path = ?, shipping_service = ?,
            order_amount = ?, payment_method = ?, shipping_address = ?
          WHERE id = ?`,
    args: [
      date, customer, store_ref || null,
      mc_pkr ? parseFloat(mc_pkr) : null,
      sc_pkr ? parseFloat(sc_pkr) : null,
      quantity ? parseInt(quantity) : 1,
      tracking || null, source, shoes_type, country, size, color,
      comments || null, image_path, shipping_service || null,
      parseFloat(order_amount), payment_method, shipping_address || null,
      id,
    ],
  });

  const updated = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
  res.json(updated.rows[0]);
});

router.put('/:id/confirm', requireRole('editor'), async (req, res) => {
  const { id } = req.params;
  const existingRes = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
  const existing = existingRes.rows[0];
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  if (!['open', 'processing'].includes(existing.status)) {
    return res.status(400).json({ error: 'Only open or processing orders can be confirmed' });
  }
  const { cad_amount, commission, confirmed_billing_account_id } = req.body;
  if (cad_amount == null || commission == null || !confirmed_billing_account_id) {
    return res.status(400).json({ error: 'cad_amount, commission, and confirmed_billing_account_id are required' });
  }
  const cadAmt = parseFloat(cad_amount);
  const comm   = parseFloat(commission);
  const net    = cadAmt - comm;
  await db.execute({
    sql: `UPDATE orders SET status = 'confirmed', cad_amount = ?, commission = ?, net_amount = ?, confirmed_billing_account_id = ? WHERE id = ?`,
    args: [cadAmt, comm, net, parseInt(confirmed_billing_account_id), id],
  });
  const updated = await db.execute({
    sql: `SELECT orders.*, billing_accounts.name as billing_account_name
          FROM orders LEFT JOIN billing_accounts ON orders.confirmed_billing_account_id = billing_accounts.id
          WHERE orders.id = ?`,
    args: [id],
  });
  res.json(updated.rows[0]);
});

router.put('/:id/status', requireRole('editor'), async (req, res) => {
  const { id } = req.params;
  const existingRes = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
  const existing = existingRes.rows[0];
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  const { status } = req.body;
  const VALID_TRANSITIONS = {
    open:           ['confirmed', 'dispute_opened', 'cancelled'],
    processing:     ['confirmed', 'open', 'cancelled'],
    dispute_opened: ['dispute_won', 'dispute_lost'],
  };
  const allowed = VALID_TRANSITIONS[existing.status] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Cannot transition from '${existing.status}' to '${status}'` });
  }
  await db.execute({ sql: 'UPDATE orders SET status = ? WHERE id = ?', args: [status, id] });
  const updated = await db.execute({
    sql: `SELECT orders.*, billing_accounts.name as billing_account_name
          FROM orders LEFT JOIN billing_accounts ON orders.confirmed_billing_account_id = billing_accounts.id
          WHERE orders.id = ?`,
    args: [id],
  });
  res.json(updated.rows[0]);
});

router.put('/:id/assign', requireRole('admin'), async (req, res) => {
  const { id } = req.params;
  const existingRes = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
  if (!existingRes.rows[0]) return res.status(404).json({ error: 'Order not found' });

  const { handler_id } = req.body;
  if (handler_id) {
    const handler = await db.execute({ sql: `SELECT id FROM users WHERE id = ? AND role = 'handler'`, args: [handler_id] });
    if (!handler.rows[0]) return res.status(400).json({ error: 'Invalid handler' });
    await db.execute({ sql: `UPDATE orders SET handler_id = ?, status = 'processing' WHERE id = ?`, args: [parseInt(handler_id), id] });
  } else {
    await db.execute({ sql: `UPDATE orders SET handler_id = NULL, status = 'open' WHERE id = ?`, args: [id] });
  }

  const updated = await db.execute({
    sql: `SELECT orders.*, billing_accounts.name as billing_account_name,
                 u.username as handler_username
          FROM orders
          LEFT JOIN billing_accounts ON orders.confirmed_billing_account_id = billing_accounts.id
          LEFT JOIN users u ON orders.handler_id = u.id
          WHERE orders.id = ?`,
    args: [id],
  });
  res.json(updated.rows[0]);
});

module.exports = router;
