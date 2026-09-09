import http from 'http';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getYouTubeInfo, downloadYouTubeAudio, searchYouTube } from './yt-converter.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DIST_DIR = path.resolve(__dirname, '../dist');

const PORT = process.env.PORT || 5173;

const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'application/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.gif': 'image/gif',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.wav': 'audio/wav',
  '.mp3': 'audio/mpeg',
  '.m4a': 'audio/mp4',
  '.webm': 'audio/webm',
  '.woff2': 'font/woff2'
};

const server = http.createServer(async (req, res) => {
  // Universal CORS Headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, X-Audio-Mime, Authorization');

  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    return res.end();
  }

  const parsedUrl = new URL(req.url, `http://${req.headers.host || 'localhost'}`);
  const pathname = parsedUrl.pathname;

  // 1. Health check
  if (pathname === '/health' || pathname === '/ping') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({ status: 'ok', uptime: process.uptime() }));
  }

  // 2. YouTube Search API
  if (pathname === '/api/yt-search') {
    const query = parsedUrl.searchParams.get('q');
    if (!query) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing search query (q)' }));
    }

    try {
      const results = await searchYouTube(query, 8);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ results }));
    } catch (err) {
      console.error('[API yt-search error]:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message || 'Search failed' }));
    }
  }

  // 3. YouTube Info API
  if (pathname === '/api/yt-info') {
    const targetUrl = parsedUrl.searchParams.get('url');
    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing url parameter' }));
    }

    try {
      const info = await getYouTubeInfo(targetUrl);
      res.writeHead(200, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify(info));
    } catch (err) {
      console.error('[API yt-info error]:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message || 'Failed to fetch YouTube info' }));
    }
  }

  // 4. YouTube Audio Download API
  if (pathname === '/api/yt-download') {
    let targetUrl = parsedUrl.searchParams.get('url');
    let trackTitle = parsedUrl.searchParams.get('title') || '';
    let trackArtist = parsedUrl.searchParams.get('artist') || '';

    if (req.method === 'POST') {
      let body = '';
      req.on('data', chunk => { body += chunk; });
      await new Promise(resolve => req.on('end', resolve));
      try {
        const parsed = JSON.parse(body);
        if (parsed.url) targetUrl = parsed.url;
        if (parsed.title) trackTitle = parsed.title;
        if (parsed.artist) trackArtist = parsed.artist;
      } catch {}
    }

    if (!targetUrl) {
      res.writeHead(400, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: 'Missing audio URL' }));
    }

    try {
      console.log(`[YouTube Converter] Downloading audio for: ${targetUrl} ("${trackTitle}" by "${trackArtist}")`);
      const audioData = await downloadYouTubeAudio(targetUrl, trackTitle, trackArtist);

      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'X-Audio-Mime': audioData.mimeType,
        'Content-Length': audioData.size,
        'Access-Control-Expose-Headers': 'X-Audio-Mime, Content-Length'
      });
      return res.end(audioData.buffer);
    } catch (err) {
      console.error('[API yt-download error]:', err);
      res.writeHead(500, { 'Content-Type': 'application/json' });
      return res.end(JSON.stringify({ error: err.message || 'Failed to download YouTube audio' }));
    }
  }

  // 5. Serve static web app assets from dist/
  if (fs.existsSync(DIST_DIR)) {
    let filePath = path.join(DIST_DIR, pathname === '/' ? 'index.html' : pathname);
    
    // Fallback to index.html for SPA routing if file doesn't exist
    if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      filePath = path.join(DIST_DIR, 'index.html');
    }

    if (fs.existsSync(filePath) && fs.statSync(filePath).isFile()) {
      const ext = path.extname(filePath).toLowerCase();
      const contentType = MIME_TYPES[ext] || 'application/octet-stream';
      res.writeHead(200, { 'Content-Type': contentType });
      return fs.createReadStream(filePath).pipe(res);
    }
  }

  res.writeHead(404, { 'Content-Type': 'text/plain' });
  res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`[Cozy Beats Cloud Server] Running on http://0.0.0.0:${PORT}`);
  
  // 24/7 Keep-awake self-ping every 10 minutes
  const KEEP_AWAKE_URL = process.env.RENDER_EXTERNAL_URL || 'https://cozy-beats.onrender.com';
  setInterval(() => {
    fetch(`${KEEP_AWAKE_URL}/health`)
      .then(r => r.json())
      .then(d => console.log('[Heartbeat] Render self-ping OK, uptime:', Math.round(d.uptime), 'sec'))
      .catch(err => console.warn('[Heartbeat] Self-ping notice:', err.message));
  }, 10 * 60 * 1000);
});

