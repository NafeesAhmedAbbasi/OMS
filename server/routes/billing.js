const express = require('express');
const { db } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const result = await db.execute('SELECT * FROM billing_accounts ORDER BY name ASC');
  res.json(result.rows);
});

router.post('/', requireRole('editor'), async (req, res) => {
  const { name, type, email } = req.body;
  if (!name || !type || !email) return res.status(400).json({ error: 'name, type, and email are required' });
  const result = await db.execute({ sql: 'INSERT INTO billing_accounts (name, type, email) VALUES (?, ?, ?)', args: [name, type, email] });
  const created = await db.execute({ sql: 'SELECT * FROM billing_accounts WHERE id = ?', args: [result.lastInsertRowid] });
  res.status(201).json(created.rows[0]);
});

router.put('/:id', requireRole('editor'), async (req, res) => {
  const { id } = req.params;
  const existing = await db.execute({ sql: 'SELECT * FROM billing_accounts WHERE id = ?', args: [id] });
  if (!existing.rows[0]) return res.status(404).json({ error: 'Billing account not found' });
  const { name, type, email } = req.body;
  if (!name || !type || !email) return res.status(400).json({ error: 'name, type, and email are required' });
  await db.execute({ sql: 'UPDATE billing_accounts SET name = ?, type = ?, email = ? WHERE id = ?', args: [name, type, email, id] });
  const updated = await db.execute({ sql: 'SELECT * FROM billing_accounts WHERE id = ?', args: [id] });
  res.json(updated.rows[0]);
});

router.delete('/:id', requireRole('editor'), async (req, res) => {
  const { id } = req.params;
  const existing = await db.execute({ sql: 'SELECT * FROM billing_accounts WHERE id = ?', args: [id] });
  if (!existing.rows[0]) return res.status(404).json({ error: 'Billing account not found' });
  await db.execute({ sql: 'DELETE FROM billing_accounts WHERE id = ?', args: [id] });
  res.json({ success: true });
});

// ── Transfers ──

router.get('/transfers', async (req, res) => {
  const result = await db.execute(`
    SELECT transfers.*, billing_accounts.name as billing_account_name
    FROM transfers
    LEFT JOIN billing_accounts ON transfers.billing_account_id = billing_accounts.id
    ORDER BY transfers.date DESC
  `);
  res.json(result.rows);
});

router.post('/transfers', requireRole('editor'), async (req, res) => {
  const { billing_account_id, amount, amount_pkr, date, service, tracking, comment } = req.body;
  if (!billing_account_id || !amount || !date || !service) {
    return res.status(400).json({ error: 'billing_account_id, amount, date, and service are required' });
  }
  const amt = parseFloat(amount);
  const commission = Math.round(amt * 0.10 * 100) / 100;
  const total_deducted = Math.round((amt + commission) * 100) / 100;
  const result = await db.execute({
    sql: `INSERT INTO transfers (billing_account_id, amount, amount_pkr, commission, total_deducted, date, service, tracking, comment)
          VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    args: [parseInt(billing_account_id), amt, amount_pkr ? parseFloat(amount_pkr) : null, commission, total_deducted, date, service, tracking || null, comment || null],
  });
  const created = await db.execute({
    sql: `SELECT transfers.*, billing_accounts.name as billing_account_name
          FROM transfers LEFT JOIN billing_accounts ON transfers.billing_account_id = billing_accounts.id
          WHERE transfers.id = ?`,
    args: [result.lastInsertRowid],
  });
  res.status(201).json(created.rows[0]);
});

router.delete('/transfers/:id', requireRole('editor'), async (req, res) => {
  const { id } = req.params;
  const existing = await db.execute({ sql: 'SELECT * FROM transfers WHERE id = ?', args: [id] });
  if (!existing.rows[0]) return res.status(404).json({ error: 'Transfer not found' });
  await db.execute({ sql: 'DELETE FROM transfers WHERE id = ?', args: [id] });
  res.json({ success: true });
});

module.exports = router;
