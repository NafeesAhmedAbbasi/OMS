const express = require('express');
const cors = require('cors');
const path = require('path');

require('./db'); // initialize schema

const app = express();

app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

app.use('/api/auth', require('./routes/auth'));
app.use('/api/orders', require('./routes/orders'));
app.use('/api/billing', require('./routes/billing'));
app.use('/api/users', require('./routes/users'));
app.use('/api/item-types', require('./routes/item-types'));
app.use('/api/handlers', require('./routes/handlers'));

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3011;
app.listen(PORT, () => console.log(`OMS server running on http://localhost:${PORT}`));
