const express = require('express');
const multer = require('multer');
const cloudinary = require('cloudinary').v2;
const { CloudinaryStorage } = require('multer-storage-cloudinary');
const db = require('../db');
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

router.get('/next-number', (req, res) => {
  const row = db.prepare('SELECT MAX(order_number) as max FROM orders').get();
  const next = row.max ? row.max + 1 : 4001;
  res.json({ next });
});

router.get('/', (req, res) => {
  const orders = db.prepare(`
    SELECT orders.*, billing_accounts.name as billing_account_name
    FROM orders
    LEFT JOIN billing_accounts ON orders.confirmed_billing_account_id = billing_accounts.id
    ORDER BY orders.order_number DESC
  `).all();
  res.json(orders);
});

router.post('/', upload.single('image'), (req, res) => {
  const {
    date, customer, store_ref, mc_pkr, sc_pkr, quantity,
    tracking, source, shoes_type, country, size, color,
    comments, shipping_service, order_amount, payment_method, shipping_address,
    order_number: order_number_input,
  } = req.body;

  if (!date || !customer || !source || !shoes_type || !country || !size || !color
      || !order_amount || !payment_method) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  let order_number;
  if (order_number_input && parseInt(order_number_input) > 0) {
    order_number = parseInt(order_number_input);
    const existing = db.prepare('SELECT id FROM orders WHERE order_number = ?').get(order_number);
    if (existing) {
      return res.status(409).json({ error: `Order #${order_number} already exists` });
    }
  } else {
    const row = db.prepare('SELECT MAX(order_number) as max FROM orders').get();
    order_number = row.max ? row.max + 1 : 4001;
  }
  const image_path = req.file ? req.file.path : null;

  const result = db.prepare(`
    INSERT INTO orders (order_number, date, customer, store_ref, mc_pkr, sc_pkr,
      quantity, tracking, source, shoes_type, country, size, color, comments,
      image_path, shipping_service, order_amount, payment_method, shipping_address)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    order_number, date, customer, store_ref || null,
    mc_pkr ? parseFloat(mc_pkr) : null,
    sc_pkr ? parseFloat(sc_pkr) : null,
    quantity ? parseInt(quantity) : 1,
    tracking || null, source, shoes_type, country, size, color,
    comments || null, image_path, shipping_service || null,
    parseFloat(order_amount), payment_method, shipping_address || null
  );

  const created = db.prepare('SELECT * FROM orders WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.put('/:id', upload.single('image'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  const {
    date, customer, store_ref, mc_pkr, sc_pkr, quantity,
    tracking, source, shoes_type, country, size, color,
    comments, shipping_service, order_amount, payment_method, shipping_address
  } = req.body;

  if (!date || !customer || !source || !shoes_type || !country || !size || !color
      || !order_amount || !payment_method) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const image_path = req.file ? req.file.path : existing.image_path;

  db.prepare(`
    UPDATE orders SET
      date = ?, customer = ?, store_ref = ?, mc_pkr = ?, sc_pkr = ?,
      quantity = ?, tracking = ?, source = ?, shoes_type = ?, country = ?,
      size = ?, color = ?, comments = ?, image_path = ?, shipping_service = ?,
      order_amount = ?, payment_method = ?, shipping_address = ?
    WHERE id = ?
  `).run(
    date, customer, store_ref || null,
    mc_pkr ? parseFloat(mc_pkr) : null,
    sc_pkr ? parseFloat(sc_pkr) : null,
    quantity ? parseInt(quantity) : 1,
    tracking || null, source, shoes_type, country, size, color,
    comments || null, image_path, shipping_service || null,
    parseFloat(order_amount), payment_method, shipping_address || null,
    id
  );

  const updated = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  res.json(updated);
});

router.put('/:id/confirm', requireRole('editor'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  if (existing.status !== 'open') {
    return res.status(400).json({ error: 'Only open orders can be confirmed' });
  }
  const { cad_amount, commission, confirmed_billing_account_id } = req.body;
  if (cad_amount == null || commission == null || !confirmed_billing_account_id) {
    return res.status(400).json({ error: 'cad_amount, commission, and confirmed_billing_account_id are required' });
  }
  const cadAmt = parseFloat(cad_amount);
  const comm   = parseFloat(commission);
  const net    = cadAmt - comm;
  db.prepare(`
    UPDATE orders SET status = 'confirmed', cad_amount = ?, commission = ?, net_amount = ?, confirmed_billing_account_id = ?
    WHERE id = ?
  `).run(cadAmt, comm, net, parseInt(confirmed_billing_account_id), id);
  const updated = db.prepare(`
    SELECT orders.*, billing_accounts.name as billing_account_name
    FROM orders LEFT JOIN billing_accounts ON orders.confirmed_billing_account_id = billing_accounts.id
    WHERE orders.id = ?
  `).get(id);
  res.json(updated);
});

router.put('/:id/status', requireRole('editor'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM orders WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Order not found' });
  const { status } = req.body;
  const VALID_TRANSITIONS = {
    open:           ['confirmed', 'dispute_opened', 'cancelled'],
    dispute_opened: ['dispute_won', 'dispute_lost'],
  };
  const allowed = VALID_TRANSITIONS[existing.status] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Cannot transition from '${existing.status}' to '${status}'` });
  }
  db.prepare('UPDATE orders SET status = ? WHERE id = ?').run(status, id);
  const updated = db.prepare(`
    SELECT orders.*, billing_accounts.name as billing_account_name
    FROM orders LEFT JOIN billing_accounts ON orders.confirmed_billing_account_id = billing_accounts.id
    WHERE orders.id = ?
  `).get(id);
  res.json(updated);
});

module.exports = router;
