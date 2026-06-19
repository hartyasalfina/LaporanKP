const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');

app.use(cors());
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR);

function readData(filename, defaultVal = []) {
  const file = path.join(DATA_DIR, filename);
  if (!fs.existsSync(file)) return defaultVal;
  try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return defaultVal; }
}
function writeData(filename, data) {
  fs.writeFileSync(path.join(DATA_DIR, filename), JSON.stringify(data, null, 2), 'utf8');
}

app.get('/api/suppliers', (req, res) => {
  let data = readData('suppliers.json');
  if (req.query.q) { const q = req.query.q.toLowerCase(); data = data.filter(s => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)); }
  res.json(data);
});
app.post('/api/suppliers', (req, res) => {
  const { name, code, phone } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Nama dan kode wajib diisi' });
  const data = readData('suppliers.json');
  if (data.find(s => s.code === code)) return res.status(400).json({ error: 'Kode supplier sudah ada' });
  const item = { id: 'SP' + Date.now(), name: name.trim(), code: code.trim().toUpperCase(), phone: phone || '', createdAt: new Date().toISOString() };
  data.push(item); writeData('suppliers.json', data); res.status(201).json(item);
});
app.delete('/api/suppliers/:id', (req, res) => {
  let data = readData('suppliers.json'); const before = data.length;
  data = data.filter(s => s.id !== req.params.id);
  if (data.length === before) return res.status(404).json({ error: 'Tidak ditemukan' });
  writeData('suppliers.json', data); res.json({ success: true });
});

app.get('/api/items', (req, res) => {
  let data = readData('items.json');
  if (req.query.kelp) data = data.filter(i => i.kelp === req.query.kelp);
  if (req.query.supplier) data = data.filter(i => i.supplierCode === req.query.supplier);
  if (req.query.q) { const q = req.query.q.toLowerCase(); data = data.filter(i => i.name.toLowerCase().includes(q) || i.code.toLowerCase().includes(q) || (i.supplierName||'').toLowerCase().includes(q)); }
  res.json(data);
});
app.post('/api/items', (req, res) => {
  const { name, code, supplierCode, supplierName, ukuran, kelp } = req.body;
  if (!name || !code) return res.status(400).json({ error: 'Nama dan kode barang wajib diisi' });
  const data = readData('items.json');
  if (data.find(i => i.code === code)) return res.status(400).json({ error: 'Kode barang sudah ada' });
  const item = { id: 'IT' + Date.now(), name: name.trim(), code: code.trim().toUpperCase(), supplierCode: supplierCode||'', supplierName: supplierName||'', ukuran: ukuran||'', kelp: kelp||'', createdAt: new Date().toISOString() };
  data.push(item); writeData('items.json', data); res.status(201).json(item);
});
app.delete('/api/items/:id', (req, res) => {
  let data = readData('items.json'); const before = data.length;
  data = data.filter(i => i.id !== req.params.id);
  if (data.length === before) return res.status(404).json({ error: 'Tidak ditemukan' });
  writeData('items.json', data); res.json({ success: true });
});

app.get('/api/tracking', (req, res) => {
  let data = readData('tracking.json');
  if (req.query.date)  data = data.filter(t => t.date === req.query.date);
  if (req.query.month) data = data.filter(t => t.date && t.date.startsWith(req.query.month));
  res.json(data);
});
app.post('/api/tracking', (req, res) => {
  const { date, user, itemId, itemName, itemCode, supplierCode, supplierName, qty, sat, kelp, ukuran } = req.body;
  if (!date || !itemId || !qty) return res.status(400).json({ error: 'date, itemId, qty wajib diisi' });
  const data = readData('tracking.json');
  const entry = { id: 'TR' + Date.now(), date, user: user||'unknown', itemId, itemName, itemCode, supplierCode: supplierCode||'', supplierName: supplierName||'', qty: parseFloat(qty), sat: sat||'pcs', kelp: kelp||'', ukuran: ukuran||'', createdAt: new Date().toISOString() };
  data.push(entry); writeData('tracking.json', data); res.status(201).json(entry);
});
app.delete('/api/tracking/:id', (req, res) => {
  let data = readData('tracking.json'); const before = data.length;
  data = data.filter(t => t.id !== req.params.id);
  if (data.length === before) return res.status(404).json({ error: 'Tidak ditemukan' });
  writeData('tracking.json', data); res.json({ success: true });
});

app.get('/api/receipt/:month', (req, res) => {
  const { month } = req.params;
  let tracking = readData('tracking.json').filter(t => t.date && t.date.startsWith(month));
  if (!tracking.length) return res.json({ month, items: [], summary: { totalItems:0, totalQty:0, totalDays:0 } });
  const grouped = {};
  tracking.forEach(t => {
    if (!grouped[t.itemCode]) grouped[t.itemCode] = { itemCode:t.itemCode, itemName:t.itemName, supplierCode:t.supplierCode, supplierName:t.supplierName, kelp:t.kelp, ukuran:t.ukuran, sat:t.sat, totalQty:0, days:new Set(), entries:[] };
    grouped[t.itemCode].totalQty += t.qty;
    grouped[t.itemCode].days.add(t.date);
    grouped[t.itemCode].entries.push({ date:t.date, qty:t.qty, user:t.user });
  });
  const items = Object.values(grouped).map(g => ({ ...g, days: g.days.size }));
  const totalDays = new Set(tracking.map(t => t.date)).size;
  const totalQty  = items.reduce((a,i) => a + i.totalQty, 0);
  res.json({ month, items, summary: { totalItems:items.length, totalQty, totalDays } });
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

app.listen(PORT, () => {
  const itLen = readData('items.json').length;
  const supLen = readData('suppliers.json').length;
  console.log('');
  console.log('  ✅  TrackBarang berjalan di http://localhost:' + PORT);
  console.log('  📦  ' + itLen + ' item barang dari Excel siap dipakai');
  console.log('  🏢  ' + supLen + ' supplier siap dipakai');
  console.log('');
});
