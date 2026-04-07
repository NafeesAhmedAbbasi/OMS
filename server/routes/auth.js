const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { db } = require('../db');
const { JWT_SECRET } = require('../middleware/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  const { username, password } = req.body;
  if (!username || !password) return res.status(400).json({ error: 'Username and password required' });

  const result = await db.execute({ sql: 'SELECT * FROM users WHERE username = ?', args: [username] });
  const user = result.rows[0];
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });

  const valid = bcrypt.compareSync(password, user.password_hash);
  if (!valid) return res.status(401).json({ error: 'Invalid credentials' });

  if (!user.is_active) return res.status(403).json({ error: 'Account is deactivated. Contact admin.' });

  const token = jwt.sign(
    { id: user.id, username: user.username, role: user.role },
    JWT_SECRET,
    { expiresIn: '8h' }
  );
  res.json({ token, user: { id: user.id, username: user.username, role: user.role } });
});

module.exports = router;
