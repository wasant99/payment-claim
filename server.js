// ═══════════════════════════════════════════
//  Payment Claim — Multi-Project Server
//  ใช้งาน: payment-claim.onrender.com/?project=ชื่อโครงการ
// ═══════════════════════════════════════════
const express = require('express');
const path = require('path');
const fs = require('fs');

const app = express();
app.use(express.json());
app.use(express.static(__dirname));

const DATA_DIR = process.env.DATA_DIR || path.join(__dirname, 'data');
if (!fs.existsSync(DATA_DIR)) fs.mkdirSync(DATA_DIR, { recursive: true });

// ─── sanitize project id ───
function safeId(pid) {
  return String(pid || '').trim().replace(/[^a-zA-Z0-9ก-๙\-_]/g, '_').slice(0, 80);
}

function dbFile(pid) {
  const id = safeId(pid);
  if (!id) throw new Error('Invalid project id');
  return path.join(DATA_DIR, `proj_${id}.json`);
}

function readDB(pid) {
  const f = dbFile(pid);
  if (!fs.existsSync(f)) {
    const init = { project: { name: pid, contractor: '', workType: '', contractValue: 0, vatRate: 7 }, periods: [] };
    fs.writeFileSync(f, JSON.stringify(init, null, 2), 'utf8');
    return init;
  }
  return JSON.parse(fs.readFileSync(f, 'utf8'));
}

function writeDB(pid, data) {
  fs.writeFileSync(dbFile(pid), JSON.stringify(data, null, 2), 'utf8');
}

// ─── API: list all projects ───
app.get('/api/projects', (req, res) => {
  try {
    const files = fs.readdirSync(DATA_DIR).filter(f => f.startsWith('proj_') && f.endsWith('.json'));
    const list = files.map(f => {
      try {
        const data = JSON.parse(fs.readFileSync(path.join(DATA_DIR, f), 'utf8'));
        const id = f.replace(/^proj_/, '').replace(/\.json$/, '');
        return { id, name: data.project?.name || id, periodCount: (data.periods || []).length };
      } catch { return null; }
    }).filter(Boolean);
    res.json(list);
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: GET project settings ───
app.get('/api/:pid/project', (req, res) => {
  try { res.json(readDB(req.params.pid).project); }
  catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: PUT project settings ───
app.put('/api/:pid/project', (req, res) => {
  try {
    const data = readDB(req.params.pid);
    data.project = { ...data.project, ...req.body };
    writeDB(req.params.pid, data);
    res.json({ ok: true, project: data.project });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: GET periods ───
app.get('/api/:pid/periods', (req, res) => {
  try {
    const data = readDB(req.params.pid);
    res.json((data.periods || []).sort((a, b) => a.no - b.no));
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: POST period ───
app.post('/api/:pid/periods', (req, res) => {
  try {
    const data = readDB(req.params.pid);
    const period = req.body;
    if (data.periods.find(p => p.no === period.no))
      return res.status(409).json({ error: 'Period exists' });
    data.periods.push(period);
    data.periods.sort((a, b) => a.no - b.no);
    writeDB(req.params.pid, data);
    res.json({ ok: true, period });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: PUT period ───
app.put('/api/:pid/periods/:no', (req, res) => {
  try {
    const data = readDB(req.params.pid);
    const no = parseInt(req.params.no);
    const idx = data.periods.findIndex(p => p.no === no);
    if (idx < 0) return res.status(404).json({ error: 'Not found' });
    data.periods[idx] = { ...req.body, no };
    writeDB(req.params.pid, data);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: DELETE period ───
app.delete('/api/:pid/periods/:no', (req, res) => {
  try {
    const data = readDB(req.params.pid);
    data.periods = data.periods.filter(p => p.no !== parseInt(req.params.no));
    writeDB(req.params.pid, data);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── API: DELETE project ───
app.delete('/api/:pid/project', (req, res) => {
  try {
    const f = dbFile(req.params.pid);
    if (fs.existsSync(f)) fs.unlinkSync(f);
    res.json({ ok: true });
  } catch (e) { res.status(500).json({ error: e.message }); }
});

// ─── Serve frontend ───
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, '0.0.0.0', () => {
  console.log(`✅ Payment Claim Multi-Project Server — port ${PORT}`);
});
