const express = require('express');
const https = require('https');
const { db } = require('../db');
const { authMiddleware, requireRole } = require('../middleware/auth');

const router = express.Router();
router.use(authMiddleware);

// ── Store Envy accounts list (any authenticated user — no keys returned) ──
router.get('/storenvy-accounts', async (req, res) => {
  const result = await db.execute('SELECT id, name, created_at FROM storenvy_accounts ORDER BY name ASC');
  res.json(result.rows);
});

router.post('/storenvy-accounts', requireRole('admin'), async (req, res) => {
  const { name, api_key } = req.body;
  if (!name || !api_key) return res.status(400).json({ error: 'name and api_key are required' });
  const result = await db.execute({ sql: 'INSERT INTO storenvy_accounts (name, api_key) VALUES (?, ?)', args: [name.trim(), api_key.trim()] });
  res.status(201).json({ id: result.lastInsertRowid, name: name.trim() });
});

router.delete('/storenvy-accounts/:id', requireRole('admin'), async (req, res) => {
  await db.execute({ sql: 'DELETE FROM storenvy_accounts WHERE id = ?', args: [req.params.id] });
  res.json({ success: true });
});

// ── Proxy: fetch orders from a specific Store Envy account ──
router.get('/storenvy-accounts/:id/orders', async (req, res) => {
  const accountRes = await db.execute({ sql: 'SELECT id, name, api_key FROM storenvy_accounts WHERE id = ?', args: [req.params.id] });
  const account = accountRes.rows[0];
  if (!account) return res.status(404).json({ error: 'Store Envy account not found' });

  const url = `https://api.storenvy.com/v1/orders.json?api_key=${encodeURIComponent(account.api_key)}&per_page=50`;

  https.get(url, (apiRes) => {
    let data = '';
    apiRes.on('data', chunk => data += chunk);
    apiRes.on('end', async () => {
      try {
        const parsed = JSON.parse(data);
        if (apiRes.statusCode !== 200) {
          return res.status(apiRes.statusCode).json({ error: parsed.message || 'Store Envy API error' });
        }
        const ordersArray = parsed?.data?.orders || parsed?.orders || (Array.isArray(parsed) ? parsed : []);

        const productIds = [...new Set(
          ordersArray.flatMap(o => (o.items || []).map(i => (i.item || i).product_id).filter(Boolean))
        )];

        const imageMap = {};
        await Promise.all(productIds.map(pid => new Promise(resolve => {
          const purl = `https://api.storenvy.com/v1/products/${pid}.json?api_key=${encodeURIComponent(account.api_key)}`;
          https.get(purl, pres => {
            let pdata = '';
            pres.on('data', c => pdata += c);
            pres.on('end', () => {
              try {
                const pp = JSON.parse(pdata);
                const photo = pp?.data?.photos?.[0]?.photo?.large || pp?.data?.photos?.[0]?.photo?.medium;
                if (photo) imageMap[pid] = photo.startsWith('//') ? 'https:' + photo : photo;
              } catch {}
              resolve();
            });
          }).on('error', resolve);
        })));

        const enriched = ordersArray.map(o => ({
          ...o,
          items: (o.items || []).map((entry, idx) => {
            const item = entry.item || entry;
            return idx === 0 && imageMap[item.product_id]
              ? { ...entry, item: { ...item, image_url: imageMap[item.product_id] } }
              : entry;
          }),
        }));

        res.json({ account: { id: account.id, name: account.name }, orders: enriched });
      } catch {
        res.status(500).json({ error: 'Invalid response from Store Envy' });
      }
    });
  }).on('error', err => {
    res.status(500).json({ error: 'Failed to reach Store Envy: ' + err.message });
  });
});

// ── Proxy: fetch an image by URL (avoids CORS on client) ──
router.get('/image-proxy', (req, res) => {
  const { url } = req.query;
  if (!url || !/^https?:\/\//i.test(url)) return res.status(400).json({ error: 'Invalid url' });
  const lib = url.startsWith('https') ? https : require('http');
  lib.get(url, (imgRes) => {
    if (imgRes.statusCode !== 200) return res.status(404).end();
    res.setHeader('Content-Type', imgRes.headers['content-type'] || 'image/jpeg');
    imgRes.pipe(res);
  }).on('error', () => res.status(500).end());
});

// ── Generic key-value settings (admin only) ──
router.get('/:key', requireRole('admin'), async (req, res) => {
  const result = await db.execute({ sql: 'SELECT value FROM app_settings WHERE key = ?', args: [req.params.key] });
  res.json({ key: req.params.key, value: result.rows[0] ? result.rows[0].value : null });
});

router.put('/:key', requireRole('admin'), async (req, res) => {
  const { value } = req.body;
  if (value == null) return res.status(400).json({ error: 'value is required' });
  await db.execute({
    sql: 'INSERT INTO app_settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value',
    args: [req.params.key, value],
  });
  res.json({ key: req.params.key, value });
});

module.exports = router;
