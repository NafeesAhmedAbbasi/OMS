const express = require('express');
const { db } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', async (req, res) => {
  const result = await db.execute('SELECT * FROM item_types ORDER BY name ASC');
  res.json(result.rows);
});

router.post('/', requireRole('admin'), async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const existing = await db.execute({ sql: 'SELECT id FROM item_types WHERE name = ?', args: [name.trim()] });
  if (existing.rows[0]) return res.status(409).json({ error: 'Item type already exists' });
  const result = await db.execute({ sql: 'INSERT INTO item_types (name) VALUES (?)', args: [name.trim()] });
  const created = await db.execute({ sql: 'SELECT * FROM item_types WHERE id = ?', args: [result.lastInsertRowid] });
  res.status(201).json(created.rows[0]);
});

router.put('/:id', requireRole('admin'), async (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const item = await db.execute({ sql: 'SELECT * FROM item_types WHERE id = ?', args: [req.params.id] });
  if (!item.rows[0]) return res.status(404).json({ error: 'Not found' });
  const existing = await db.execute({ sql: 'SELECT id FROM item_types WHERE name = ? AND id != ?', args: [name.trim(), req.params.id] });
  if (existing.rows[0]) return res.status(409).json({ error: 'Name already exists' });
  await db.execute({ sql: 'UPDATE item_types SET name = ? WHERE id = ?', args: [name.trim(), req.params.id] });
  const updated = await db.execute({ sql: 'SELECT * FROM item_types WHERE id = ?', args: [req.params.id] });
  res.json(updated.rows[0]);
});

router.delete('/:id', requireRole('admin'), async (req, res) => {
  const item = await db.execute({ sql: 'SELECT * FROM item_types WHERE id = ?', args: [req.params.id] });
  if (!item.rows[0]) return res.status(404).json({ error: 'Not found' });
  await db.execute({ sql: 'DELETE FROM item_types WHERE id = ?', args: [req.params.id] });
  res.json({ success: true });
});

module.exports = router;
