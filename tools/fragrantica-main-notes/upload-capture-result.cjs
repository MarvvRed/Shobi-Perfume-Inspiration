const fs = require('fs');
const https = require('https');

const token = process.env.GH_TOKEN;
const file = process.env.SHOBI_OUT;
const repo = 'MarvvRed/Shobi-Perfume-Inspiration';
const repoPath = 'tools/fragrantica-main-notes/results/vanilla-28-runner.json';

if (!token || !file || !fs.existsSync(file)) {
  console.log('UPLOAD_SKIPPED missing token or result file');
  process.exit(0);
}

function request(method, path, body) {
  return new Promise((resolve, reject) => {
    const req = https.request({
      hostname: 'api.github.com',
      path,
      method,
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/vnd.github+json',
        'X-GitHub-Api-Version': '2022-11-28',
        'User-Agent': 'shobi-self-hosted-runner',
        ...(body ? {'Content-Type':'application/json','Content-Length':Buffer.byteLength(body)} : {})
      }
    }, res => {
      let data='';
      res.on('data', d => data += d);
      res.on('end', () => resolve({status: res.statusCode, data}));
    });
    req.on('error', reject);
    if (body) req.write(body);
    req.end();
  });
}

(async () => {
  const apiPath = `/repos/${repo}/contents/${repoPath}`;
  let sha;
  const existing = await request('GET', apiPath);
  if (existing.status === 200) {
    try { sha = JSON.parse(existing.data).sha; } catch {}
  }
  const payload = {
    message: 'Update Vanilla 28 runner capture result',
    content: fs.readFileSync(file).toString('base64'),
    branch: 'main',
    ...(sha ? {sha} : {})
  };
  const put = await request('PUT', apiPath, JSON.stringify(payload));
  console.log('UPLOAD_STATUS=' + put.status);
  if (put.status < 200 || put.status >= 300) console.log(put.data.slice(0, 1000));
})().catch(e => { console.log('UPLOAD_ERROR=' + e.message); process.exit(0); });
