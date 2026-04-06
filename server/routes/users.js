const express = require('express');
const bcrypt = require('bcryptjs');
const db = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);
router.use(requireRole('admin'));

// List all users (exclude password_hash)
router.get('/', (req, res) => {
  const users = db.prepare('SELECT id, username, role, is_active FROM users ORDER BY username ASC').all();
  res.json(users);
});

// Create user
router.post('/', (req, res) => {
  const { username, password, role } = req.body;
  if (!username || !password || !role) {
    return res.status(400).json({ error: 'username, password, and role are required' });
  }
  const VALID_ROLES = ['admin', 'deo', 'editor', 'handler'];
  if (!VALID_ROLES.includes(role)) {
    return res.status(400).json({ error: 'Invalid role' });
  }
  const existing = db.prepare('SELECT id FROM users WHERE username = ?').get(username);
  if (existing) {
    return res.status(409).json({ error: 'Username already exists' });
  }
  const password_hash = bcrypt.hashSync(password, 10);
  const result = db.prepare(
    'INSERT INTO users (username, password_hash, role, is_active) VALUES (?, ?, ?, 1)'
  ).run(username, password_hash, role);
  const created = db.prepare('SELECT id, username, role, is_active FROM users WHERE id = ?').get(result.lastInsertRowid);
  res.status(201).json(created);
});

// Toggle active/inactive
router.patch('/:id/active', (req, res) => {
  const { id } = req.params;
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  if (user.role === 'admin' && req.user.id === user.id) {
    return res.status(400).json({ error: 'Cannot deactivate your own admin account' });
  }
  const newStatus = user.is_active ? 0 : 1;
  db.prepare('UPDATE users SET is_active = ? WHERE id = ?').run(newStatus, id);
  res.json({ id: user.id, username: user.username, role: user.role, is_active: newStatus });
});

// Reset password
router.patch('/:id/password', (req, res) => {
  const { id } = req.params;
  const { password } = req.body;
  if (!password || password.length < 4) {
    return res.status(400).json({ error: 'Password must be at least 4 characters' });
  }
  const user = db.prepare('SELECT id FROM users WHERE id = ?').get(id);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const password_hash = bcrypt.hashSync(password, 10);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(password_hash, id);
  res.json({ success: true });
});

module.exports = router;
