const express = require('express');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

router.get('/', (req, res) => {
  res.json(db.prepare('SELECT * FROM item_types ORDER BY name ASC').all());
});

router.post('/', requireRole('admin'), (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const existing = db.prepare('SELECT id FROM item_types WHERE name = ?').get(name.trim());
  if (existing) return res.status(409).json({ error: 'Item type already exists' });
  const result = db.prepare('INSERT INTO item_types (name) VALUES (?)').run(name.trim());
  res.status(201).json(db.prepare('SELECT * FROM item_types WHERE id = ?').get(result.lastInsertRowid));
});

router.put('/:id', requireRole('admin'), (req, res) => {
  const { name } = req.body;
  if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required' });
  const item = db.prepare('SELECT * FROM item_types WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  const existing = db.prepare('SELECT id FROM item_types WHERE name = ? AND id != ?').get(name.trim(), req.params.id);
  if (existing) return res.status(409).json({ error: 'Name already exists' });
  db.prepare('UPDATE item_types SET name = ? WHERE id = ?').run(name.trim(), req.params.id);
  res.json(db.prepare('SELECT * FROM item_types WHERE id = ?').get(req.params.id));
});

router.delete('/:id', requireRole('admin'), (req, res) => {
  const item = db.prepare('SELECT * FROM item_types WHERE id = ?').get(req.params.id);
  if (!item) return res.status(404).json({ error: 'Not found' });
  db.prepare('DELETE FROM item_types WHERE id = ?').run(req.params.id);
  res.json({ success: true });
});

module.exports = router;
