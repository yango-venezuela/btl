const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;
const ROOT = __dirname;
const APPS_SCRIPT_URL = process.env.APPS_SCRIPT_URL || 'https://script.google.com/macros/s/AKfycbyD03wun8PJpAxWpLk5EhKnI4S3V6Crfoho87KPcJCZAcGvFFjKOTew_6NFUult-2EYkw/exec';

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml; charset=utf-8',
};

function send(res, status, body, type = 'text/plain; charset=utf-8') {
  res.writeHead(status, {
    'Content-Type': type,
    'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET,POST,OPTIONS',
  });
  res.end(body);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    req.on('data', chunk => {
      body += chunk;
      if (body.length > 2_000_000) {
        reject(new Error('Request too large'));
        req.destroy();
      }
    });
    req.on('end', () => resolve(body));
    req.on('error', reject);
  });
}

async function proxyToAppsScript(req, res, url) {
  try {
    if (!APPS_SCRIPT_URL) {
      return send(res, 503, JSON.stringify({ ok: false, error: 'APPS_SCRIPT_URL is not configured' }), 'application/json; charset=utf-8');
    }

    if (req.method === 'GET') {
      const target = new URL(APPS_SCRIPT_URL);
      for (const [key, value] of url.searchParams.entries()) target.searchParams.set(key, value);
      const response = await fetch(target.toString(), { method: 'GET', redirect: 'follow' });
      const text = await response.text();
      return send(res, response.ok ? 200 : response.status, text || '{}', response.headers.get('content-type') || 'application/json; charset=utf-8');
    }

    if (req.method === 'POST') {
      const raw = await readBody(req);
      const response = await fetch(APPS_SCRIPT_URL, {
        method: 'POST',
        redirect: 'follow',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: raw || '{}',
      });
      const text = await response.text();
      return send(res, response.ok ? 200 : response.status, text || '{}', response.headers.get('content-type') || 'application/json; charset=utf-8');
    }

    return send(res, 405, JSON.stringify({ ok: false, error: 'Method not allowed' }), 'application/json; charset=utf-8');
  } catch (error) {
    return send(res, 502, JSON.stringify({ ok: false, error: error.message || 'Apps Script proxy failed' }), 'application/json; charset=utf-8');
  }
}

const server = http.createServer((req, res) => {
  const url = new URL(req.url, `http://${req.headers.host}`);

  if (req.method === 'OPTIONS') return send(res, 204, '');

  if (url.pathname === '/api/health') {
    return send(res, 200, JSON.stringify({ ok: true, app: 'yango-mkt-social-v1', clean: true, appsScriptConfigured: Boolean(APPS_SCRIPT_URL) }), 'application/json; charset=utf-8');
  }

  if (url.pathname === '/api/sync') {
    return proxyToAppsScript(req, res, url);
  }

  const requested = url.pathname === '/' ? '/index.html' : url.pathname;
  const safePath = path.normalize(requested).replace(/^\/+/, '');
  const filePath = path.join(ROOT, safePath);

  if (!filePath.startsWith(ROOT)) return send(res, 403, 'Forbidden');

  fs.readFile(filePath, (err, data) => {
    if (err) {
      fs.readFile(path.join(ROOT, 'index.html'), (fallbackErr, fallback) => {
        if (fallbackErr) return send(res, 500, 'Panel no disponible');
        return send(res, 200, fallback, MIME['.html']);
      });
      return;
    }
    const ext = path.extname(filePath).toLowerCase();
    send(res, 200, data, MIME[ext] || 'application/octet-stream');
  });
});

server.listen(PORT, () => {
  console.log(`Yango MKT Social Media v1 running on ${PORT}`);
});
