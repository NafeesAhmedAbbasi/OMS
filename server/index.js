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

app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

const PORT = process.env.PORT || 3011;
app.listen(PORT, () => console.log(`OMS server running on http://localhost:${PORT}`));
