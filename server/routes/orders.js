const express = require('express');
const https = require('https');
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

router.post('/', upload.array('images', 4), async (req, res) => {
  const {
    date, customer, store_ref, mc_pkr, sc_pkr, quantity,
    tracking, source, shoes_type, country, size, color,
    comments, shipping_service, order_amount, payment_method, shipping_address,
    order_number: order_number_input, image_url,
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
  const image_path = req.files?.length
    ? req.files.map(f => f.path).join(',')
    : (image_url?.trim() || null);

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

router.put('/:id', upload.array('images', 4), async (req, res) => {
  const { id } = req.params;
  const existingRes = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
  const existing = existingRes.rows[0];
  if (!existing) return res.status(404).json({ error: 'Order not found' });

  const {
    date, customer, store_ref, mc_pkr, sc_pkr, quantity,
    tracking, source, shoes_type, country, size, color,
    comments, shipping_service, order_amount, payment_method, shipping_address,
    image_url, keep_images,
  } = req.body;

  if (!date || !customer || !source || !shoes_type || !country || !size || !color || !order_amount || !payment_method) {
    return res.status(400).json({ error: 'Missing required fields' });
  }

  // Build new image_path:
  // keep_images = comma-separated list of existing URLs to keep (sent by client after removals)
  // new uploads are appended, up to 4 total
  let kept = keep_images ? keep_images.split(',').filter(Boolean) : (existing.image_path ? existing.image_path.split(',').filter(Boolean) : []);
  if (req.files?.length) {
    const newPaths = req.files.map(f => f.path);
    kept = [...kept, ...newPaths].slice(0, 4);
  } else if (image_url?.trim()) {
    kept = [...kept, image_url.trim()].slice(0, 4);
  }
  const image_path = kept.length ? kept.join(',') : null;

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

  const { status, cancel_manufacturing_pkr, cancel_shipping_pkr, cancel_commission_pkr, cancel_note } = req.body;
  const isAdmin = req.user.role === 'admin';

  // Admins can cancel from any non-terminal status; editors follow normal transitions
  const VALID_TRANSITIONS = {
    open:           ['confirmed', 'dispute_opened', 'cancelled'],
    processing:     ['confirmed', 'open', 'cancelled'],
    confirmed:      isAdmin ? ['cancelled'] : [],
    dispute_opened: ['dispute_won', 'dispute_lost', ...(isAdmin ? ['cancelled'] : [])],
    dispute_won:    isAdmin ? ['cancelled'] : [],
    dispute_lost:   isAdmin ? ['cancelled'] : [],
  };
  const allowed = VALID_TRANSITIONS[existing.status] || [];
  if (!allowed.includes(status)) {
    return res.status(400).json({ error: `Cannot transition from '${existing.status}' to '${status}'` });
  }

  await db.execute({ sql: 'UPDATE orders SET status = ? WHERE id = ?', args: [status, id] });

  // If cancelling with cost overrides and the order has a handler, create/replace a cancellation bill
  if (status === 'cancelled' && existing.handler_id && isAdmin) {
    const mfg  = parseFloat(cancel_manufacturing_pkr) || 0;
    const ship = parseFloat(cancel_shipping_pkr)      || 0;
    const comm = parseFloat(cancel_commission_pkr)    || 0;
    if (mfg > 0 || ship > 0 || comm > 0) {
      const total = mfg + ship + comm;
      const note  = cancel_note || 'Cancellation costs';
      const today = new Date().toISOString().slice(0, 10);
      // Remove any existing bill for this order first to avoid duplicates
      await db.execute({ sql: 'DELETE FROM handler_bills WHERE order_id = ? AND handler_user_id = ?', args: [id, existing.handler_id] });
      await db.execute({
        sql: `INSERT INTO handler_bills (handler_user_id, order_id, order_number, item_type, shipping_cost_pkr, manufacturing_cost_pkr, commission_pkr, total_pkr, note, date)
              VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        args: [existing.handler_id, parseInt(id), existing.order_number, existing.shoes_type, ship, mfg, comm, total, note, today],
      });
    }
  }

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

// ── Sync tracking to Store Envy (mark shipped) ──
router.post('/:id/sync-storenvy', async (req, res) => {
  const { id } = req.params;
  const orderRes = await db.execute({ sql: 'SELECT * FROM orders WHERE id = ?', args: [id] });
  const order = orderRes.rows[0];
  if (!order) return res.status(404).json({ error: 'Order not found' });
  if (order.source !== 'Store Envy') return res.status(400).json({ error: 'Not a Store Envy order' });
  if (!order.store_ref) return res.status(400).json({ error: 'No Store Envy order ID (store_ref) on this order' });
  if (!order.tracking) return res.status(400).json({ error: 'No tracking number to sync' });

  // Look up the Store Envy API key — find the account whose name matches or just use the first one
  const accountsRes = await db.execute('SELECT id, name, api_key FROM storenvy_accounts ORDER BY id ASC');
  if (!accountsRes.rows.length) return res.status(400).json({ error: 'No Store Envy account configured in Settings' });

  // Use the first account (or match by name if stored)
  const account = accountsRes.rows[0];
  const apiKey  = account.api_key;
  const seOrderId = order.store_ref;

  const postData = JSON.stringify({
    order: {
      fulfillment_status: 'shipped',
      tracking_number: order.tracking,
      shipping_carrier: order.shipping_service || '',
    }
  });

  const options = {
    hostname: 'api.storenvy.com',
    path: `/v1/orders/${seOrderId}.json?api_key=${encodeURIComponent(apiKey)}`,
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'Content-Length': Buffer.byteLength(postData) },
  };

  const seReq = https.request(options, (seRes) => {
    let data = '';
    seRes.on('data', c => data += c);
    seRes.on('end', () => {
      try {
        const parsed = JSON.parse(data);
        if (seRes.statusCode >= 400) {
          return res.status(seRes.statusCode).json({ error: parsed.message || 'Store Envy API error', details: parsed });
        }
        res.json({ success: true, storenvy_status: seRes.statusCode });
      } catch {
        res.status(500).json({ error: 'Invalid response from Store Envy' });
      }
    });
  });
  seReq.on('error', err => res.status(500).json({ error: 'Failed to reach Store Envy: ' + err.message }));
  seReq.write(postData);
  seReq.end();
});

module.exports = router;
