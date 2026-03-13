// ═══════════════════════════════════════════
//  Payment Claim — Backend Server
//  Node.js + Express + SQLite (no install needed on Replit)
// ═══════════════════════════════════════════
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

// ─── Simple JSON file database (works on Replit free tier) ───
// Store data in /app/data so Docker volume persists it
const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });
const DB_FILE = path.join(DATA_DIR, 'data.json');

function readDB() {
  if (!fs.existsSync(DB_FILE)) {
    const init = {
      project: {
        name: 'โครงการ อภิทาวน์ ฉะเชิงเทรา',
        contractor: 'บริษัท ไทย ฮาเซคาวา คอนสตรัคชั่น จำกัด',
        workType: 'งานถนนและวางท่อระบายน้ำ',
        contractValue: 26358733.54,
        vatRate: 7
      },
      periods: []
    };
    fs.writeFileSync(DB_FILE, JSON.stringify(init, null, 2), 'utf8');
    return init;
  }
  return JSON.parse(fs.readFileSync(DB_FILE, 'utf8'));
}

function writeDB(data) {
  fs.writeFileSync(DB_FILE, JSON.stringify(data, null, 2), 'utf8');
}

// ─── API: GET project ───
app.get('/api/project', (req, res) => {
  const db = readDB();
  res.json(db.project);
});

// ─── API: PUT project ───
app.put('/api/project', (req, res) => {
  const db = readDB();
  db.project = { ...db.project, ...req.body };
  writeDB(db);
  res.json({ ok: true, project: db.project });
});

// ─── API: GET all periods ───
app.get('/api/periods', (req, res) => {
  const db = readDB();
  res.json(db.periods.sort((a, b) => a.no - b.no));
});

// ─── API: POST new period ───
app.post('/api/periods', (req, res) => {
  const db = readDB();
  const period = req.body;
  const exists = db.periods.find(p => p.no === period.no);
  if (exists) {
    return res.status(409).json({ error: 'Period already exists' });
  }
  db.periods.push(period);
  db.periods.sort((a, b) => a.no - b.no);
  writeDB(db);
  res.json({ ok: true, period });
});

// ─── API: PUT update period ───
app.put('/api/periods/:no', (req, res) => {
  const db = readDB();
  const no = parseInt(req.params.no);
  const idx = db.periods.findIndex(p => p.no === no);
  if (idx < 0) return res.status(404).json({ error: 'Not found' });
  db.periods[idx] = { ...req.body, no };
  writeDB(db);
  res.json({ ok: true, period: db.periods[idx] });
});

// ─── API: DELETE period ───
app.delete('/api/periods/:no', (req, res) => {
  const db = readDB();
  const no = parseInt(req.params.no);
  db.periods = db.periods.filter(p => p.no !== no);
  writeDB(db);
  res.json({ ok: true });
});

// ─── Serve frontend for all other routes ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Payment Claim Server running on port ${PORT}`);
});
