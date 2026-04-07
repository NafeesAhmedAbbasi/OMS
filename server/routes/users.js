const express = require('express');
const bcrypt = require('bcryptjs');
const { db } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('admin'));

router.get('/', async (req, res) => {
  const result = await db.execute('SELECT id, username, role, is_active FROM users ORDER BY username ASC');
  res.json(result.rows);
});

router.post('/', async (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) return res.status(400).json({ error: 'username, password, and role are required' });
  const VALID_ROLES = ['admin', 'deo', 'editor', 'handler'];
  if (!VALID_ROLES.includes(role)) return res.status(400).json({ error: 'Invalid role' });

  const existing = await db.execute({ sql: 'SELECT id FROM users WHERE username = ?', args: [username] });
  if (existing.rows[0]) return res.status(409).json({ error: 'Username already exists' });

  const password_hash = bcrypt.hashSync(password, 10);
  const result = await db.execute({
    sql: 'INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)',
    args: [username, password_hash, role],
  });
  const created = await db.execute({ sql: 'SELECT id, username, role, is_active FROM users WHERE id = ?', args: [result.lastInsertRowid] });
  res.status(201).json(created.rows[0]);
});

router.patch('/:id/active', async (req, res) => {
  const { id } = req.params;
  const userRes = await db.execute({ sql: 'SELECT * FROM users WHERE id = ?', args: [id] });
  const user = userRes.rows[0];
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin' && req.user.id === user.id) return res.status(400).json({ error: 'Cannot deactivate your own admin account' });
  const newStatus = user.is_active ? 0 : 1;
  await db.execute({ sql: 'UPDATE users SET is_active = ? WHERE id = ?', args: [newStatus, id] });
  res.json({ id: user.id, username: user.username, role: user.role, is_active: newStatus });
});

router.patch('/:id/password', async (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password || password.length < 4) return res.status(400).json({ error: 'Password must be at least 4 characters' });
  const userRes = await db.execute({ sql: 'SELECT id FROM users WHERE id = ?', args: [id] });
  if (!userRes.rows[0]) return res.status(404).json({ error: 'User not found' });
  const password_hash = bcrypt.hashSync(password, 10);
  await db.execute({ sql: 'UPDATE users SET password_hash = ? WHERE id = ?', args: [password_hash, id] });
  res.json({ success: true });
});

module.exports = router;
