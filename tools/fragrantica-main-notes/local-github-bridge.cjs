const http = require('http');
const https = require('https');

const TOKEN = process.env.GH_TOKEN;
const OWNER = 'MarvvRed';
const REPO = 'Shobi-Perfume-Inspiration';
const BRANCH = 'main';

if (!TOKEN) {
  console.error('GH_TOKEN missing');
  process.exit(2);
}

function gh(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'User-Agent': 'shobi-local-bridge',
        'Authorization': `Bearer ${TOKEN}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        ...(body ? { 'Content-Type': 'application/json' } : {})
      }
    }, res => {
      let data = '';
      res.on('data', c => data += c);
      res.on('end', () => {
        if (res.statusCode >= 200 && res.statusCode < 300) {
          resolve(data ? JSON.parse(data) : {});
        } else {
          reject(new Error(`GitHub ${res.statusCode}: ${data}`));
        }
      });
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

function slugFromUrl(url) {
  try {
    const u = new URL(url);
    const last = u.pathname.split('/').filter(Boolean).pop() || 'capture';
    return last.replace(/\.html$/i, '').replace(/[^a-z0-9._-]+/gi, '-').toLowerCase();
  } catch {
    return `capture-${Date.now()}`;
  }
}

async function saveCapture(data) {
  const payload = data?.payload;
  if (!payload?.url || !Array.isArray(payload.notes) || !payload.notes.length) throw new Error('Invalid capture payload');
  if (!payload.url.startsWith('https://www.fragrantica.com/perfume/')) throw new Error('Unexpected source URL');

  const slug = slugFromUrl(payload.url);
  const filePath = `tools/fragrantica-main-notes/results/live/${slug}.json`;
  const apiPath = `/repos/${OWNER}/${REPO}/contents/${filePath}`;
  let sha;
  try {
    const existing = await gh('GET', `${apiPath}?ref=${BRANCH}`);
    sha = existing.sha;
  } catch (e) {
    if (!String(e.message).includes('GitHub 404')) throw e;
  }

  const normalized = {
    source: data.source || 'firefox-extension',
    batch: data.batch || null,
    target: data.target || null,
    ...payload,
    received_at: new Date().toISOString()
  };

  const body = {
    message: `Capture Fragrantica Main Notes: ${payload.perfume || slug}`,
    content: Buffer.from(JSON.stringify(normalized, null, 2) + '\n').toString('base64'),
    branch: BRANCH,
    ...(sha ? { sha } : {})
  };

  await gh('PUT', apiPath, body);
  console.log(`SAVED ${filePath}`);
  return filePath;
}

const server = http.createServer(async (req, res) => {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    return res.end();
  }
  if (req.method === 'GET' && req.url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ ok: true }));
  }
  if (req.method === 'POST' && req.url === '/capture') {
    let raw = '';
    req.on('data', c => {
      raw += c;
      if (raw.length > 2_000_000) req.destroy();
    });
    req.on('end', async () => {
      try {
        const data = JSON.parse(raw);
        const file = await saveCapture(data);
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: true, file }));
      } catch (e) {
        console.error('CAPTURE_ERROR', e.message);
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ ok: false, error: e.message }));
      }
    });
    return;
  }
  res.writeHead(404);
  res.end();
});

server.listen(8765, '127.0.0.1', () => {
  console.log('SHOBI_LOCAL_BRIDGE_READY http://127.0.0.1:8765');
});

setTimeout(() => {
  console.log('SHOBI_LOCAL_BRIDGE_TIMEOUT');
  server.close(() => process.exit(0));
}, 30 * 60 * 1000);
