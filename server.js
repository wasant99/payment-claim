// ═══════════════════════════════════════════
//  Payment Claim — Multi-Project Server
//  ใช้ MongoDB Atlas เพื่อเก็บข้อมูลถาวร
// ═══════════════════════════════════════════
const express = require('express');
const path = require('path');
const { MongoClient } = require('mongodb');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// ─── MongoDB connection ───
const MONGODB_URI = process.env.MONGODB_URI;
let db;

async function connectDB() {
  const client = new MongoClient(MONGODB_URI, { tls: true, tlsAllowInvalidCertificates: true, serverSelectionTimeoutMS: 10000 });
  await client.connect();
  db = client.db('payment-claim');
  console.log('✅ Connected to MongoDB Atlas');
}

function col() { return db.collection('projects'); }

// ─── API: list projects ───
app.get('/api/projects', async (req, res) => {
  try {
    const docs = await col().find({}, { projection: { _id:0, id:1, 'project.name':1, periods:1 } }).toArray();
    const list = docs.map(d => ({
      id: d.id,
      name: d.project?.name || d.id,
      periodCount: (d.periods || []).length
    }));
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: POST project (create) ───
app.post('/api/:pid/project', async (req, res) => {
  try {
    const id = req.params.pid;
    const exists = await col().findOne({ id });
    if (exists) return res.status(409).json({ error: 'Project already exists' });
    await col().insertOne({ id, project: { name: id, contractor: '', workType: '', contractValue: 0, vatRate: 7, ...req.body }, periods: [] });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: GET project ───
app.get('/api/:pid/project', async (req, res) => {
  try {
    const doc = await col().findOne({ id: req.params.pid });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json(doc.project);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: PUT project ───
app.put('/api/:pid/project', async (req, res) => {
  try {
    await col().updateOne({ id: req.params.pid }, { $set: { project: req.body } }, { upsert: true });
    res.json({ ok: true, project: req.body });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: DELETE project ───
app.delete('/api/:pid/project', async (req, res) => {
  try {
    await col().deleteOne({ id: req.params.pid });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: GET periods ───
app.get('/api/:pid/periods', async (req, res) => {
  try {
    const doc = await col().findOne({ id: req.params.pid });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    res.json((doc.periods || []).sort((a, b) => a.no - b.no));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: POST period ───
app.post('/api/:pid/periods', async (req, res) => {
  try {
    const doc = await col().findOne({ id: req.params.pid });
    if (!doc) return res.status(404).json({ error: 'Not found' });
    if ((doc.periods || []).find(p => p.no === req.body.no))
      return res.status(409).json({ error: 'Period exists' });
    await col().updateOne({ id: req.params.pid }, { $push: { periods: req.body } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: PUT period ───
app.put('/api/:pid/periods/:no', async (req, res) => {
  try {
    const no = parseInt(req.params.no);
    await col().updateOne(
      { id: req.params.pid, 'periods.no': no },
      { $set: { 'periods.$': { ...req.body, no } } }
    );
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: DELETE period ───
app.delete('/api/:pid/periods/:no', async (req, res) => {
  try {
    const no = parseInt(req.params.no);
    await col().updateOne({ id: req.params.pid }, { $pull: { periods: { no } } });
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Serve frontend ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// ─── Start ───
const PORT = process.env.PORT || 3000;
connectDB().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`✅ Payment Claim Server running on port ${PORT}`);
  });
}).catch(err => {
  console.error('❌ MongoDB connection failed:', err.message);
  process.exit(1);
});
