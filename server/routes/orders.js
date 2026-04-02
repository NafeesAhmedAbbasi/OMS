const express = require('express');
const multer = require('multer');
const path = require('path');
const db = require('../db');
const { authMiddleware } = require('../middleware/auth');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '../uploads'),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `order-${Date.now()}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

router.use(authMiddleware);

router.get('/next-number', (req, res) => {
  const row = db.prepare('SELECT MAX(order_number) as max FROM orders').get();
  const next = row.max ? row.max + 1 : 4001;
  res.json({ next });
});

router.get('/', (req, res) => {
  const orders = db.prepare('SELECT * FROM orders ORDER BY order_number DESC').all();
  res.json(orders);
});

router.post('/', upload.single('image'), (req, res) => {
  const {
    date, customer, store_ref, mc_pkr, sc_pkr, quantity,
    tracking, source, shoes_type, country, size, color,
    comments, shipping_service, order_amount, payment_method, shipping_address
  } = req.body;

  if (!date || !customer || !source || !shoes_type || !country || !size || !color
      || !order_amount || !payment_method) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  const row = db.prepare('SELECT MAX(order_number) as max FROM orders').get();
  const order_number = row.max ? row.max + 1 : 4001;
  const image_path = req.file ? `/uploads/${req.file.filename}` : null;

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

  const image_path = req.file ? `/uploads/${req.file.filename}` : existing.image_path;

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

module.exports = router;
