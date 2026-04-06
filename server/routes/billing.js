const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  const accounts = db.prepare('SELECT * FROM billing_accounts ORDER BY name ASC').all();
  res.json(accounts);
});

router.post('/', requireRole('editor'), (req, res) => {
  const { name, type, email } = req.body;
  if (!name || !type || !email) {
    return res.status(400).json({ error: 'name, type, and email are required' });
  }
  const result = db.prepare(
    'INSERT INTO billing_accounts (name, type, email) VALUES (?, ?, ?)'
  ).run(name, type, email);
  const created = db.prepare('SELECT * FROM billing_accounts WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.put('/:id', requireRole('editor'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM billing_accounts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Billing account not found' });
  const { name, type, email } = req.body;
  if (!name || !type || !email) {
    return res.status(400).json({ error: 'name, type, and email are required' });
  }
  db.prepare('UPDATE billing_accounts SET name = ?, type = ?, email = ? WHERE id = ?').run(name, type, email, id);
  const updated = db.prepare('SELECT * FROM billing_accounts WHERE id = ?').get(id);
  res.json(updated);
});

router.delete('/:id', requireRole('editor'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM billing_accounts WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Billing account not found' });
  db.prepare('DELETE FROM billing_accounts WHERE id = ?').run(id);
  res.json({ success: true });
});

// ── Transfers ──

router.get('/transfers', (req, res) => {
  const transfers = db.prepare(`
    SELECT transfers.*, billing_accounts.name as billing_account_name
    FROM transfers
    LEFT JOIN billing_accounts ON transfers.billing_account_id = billing_accounts.id
    ORDER BY transfers.date DESC
  `).all();
  res.json(transfers);
});

router.post('/transfers', requireRole('editor'), (req, res) => {
  const { billing_account_id, amount, amount_pkr, date, service, tracking, comment } = req.body;
  if (!billing_account_id || !amount || !date || !service) {
    return res.status(400).json({ error: 'billing_account_id, amount, date, and service are required' });
  }
  const amt = parseFloat(amount);
  const commission = Math.round(amt * 0.10 * 100) / 100;
  const total_deducted = Math.round((amt + commission) * 100) / 100;
  const result = db.prepare(`
    INSERT INTO transfers (billing_account_id, amount, amount_pkr, commission, total_deducted, date, service, tracking, comment)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(parseInt(billing_account_id), amt, amount_pkr ? parseFloat(amount_pkr) : null, commission, total_deducted, date, service, tracking || null, comment || null);
  const created = db.prepare(`
    SELECT transfers.*, billing_accounts.name as billing_account_name
    FROM transfers LEFT JOIN billing_accounts ON transfers.billing_account_id = billing_accounts.id
    WHERE transfers.id = ?
  `).get(result.lastInsertRowid);
  res.status(201).json(created);
});

router.delete('/transfers/:id', requireRole('editor'), (req, res) => {
  const { id } = req.params;
  const existing = db.prepare('SELECT * FROM transfers WHERE id = ?').get(id);
  if (!existing) return res.status(404).json({ error: 'Transfer not found' });
  db.prepare('DELETE FROM transfers WHERE id = ?').run(id);
  res.json({ success: true });
});

module.exports = router;
