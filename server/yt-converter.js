import { exec, spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const getYtDlpSpawn = () => {
  if (process.platform === 'win32') {
    return { command: 'python', prefixArgs: ['-m', 'yt_dlp'] };
  }
  return { command: 'yt-dlp', prefixArgs: [] };
};

const getYtDlpExecCmd = () => {
  if (process.platform === 'win32') {
    return 'python -m yt_dlp';
  }
  return 'yt-dlp';
};

/**
 * Get YouTube video metadata quickly
 */
export async function getYouTubeInfo(url) {
  // First try fast oEmbed for immediate title, author and thumbnail
  let oembedData = null;
  try {
    const oembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    if (oembedRes.ok) {
      oembedData = await oembedRes.json();
    }
  } catch (err) {
    console.warn('oEmbed fetch error:', err);
  }

  // Next run yt-dlp to get accurate duration and format info
  return new Promise((resolve, reject) => {
    const baseCmd = getYtDlpExecCmd();
    const cmd = `${baseCmd} --skip-download --dump-json --no-warnings "${url}"`;
    exec(cmd, { maxBuffer: 10 * 1024 * 1024 }, (error, stdout) => {
      if (error) {
        // Fallback to oembed data if available
        if (oembedData && oembedData.title) {
          return resolve({
            title: oembedData.title,
            artist: oembedData.author_name || 'YouTube Audio',
            duration: 180,
            thumbnail: oembedData.thumbnail_url,
            url: url
          });
        }
        return reject(new Error(error.message));
      }

      try {
        const info = JSON.parse(stdout);
        resolve({
          title: info.title || oembedData?.title || 'YouTube Track',
          artist: info.uploader || info.channel || oembedData?.author_name || 'YouTube Audio',
          duration: info.duration || 0,
          thumbnail: info.thumbnail || oembedData?.thumbnail_url,
          id: info.id,
          url: url
        });
      } catch (parseErr) {
        if (oembedData && oembedData.title) {
          return resolve({
            title: oembedData.title,
            artist: oembedData.author_name || 'YouTube Audio',
            duration: 180,
            thumbnail: oembedData.thumbnail_url,
            url: url
          });
        }
        reject(parseErr);
      }
    });
  });
}

/**
 * Download YouTube audio to a temporary file and return the file buffer & metadata
 */
export async function downloadYouTubeAudio(url) {
  const tempDir = path.join(os.tmpdir(), 'cozy_beats_yt_' + Date.now());
  fs.mkdirSync(tempDir, { recursive: true });
  const outputTemplate = path.join(tempDir, '%(id)s.%(ext)s');

  return new Promise((resolve, reject) => {
    const runner = getYtDlpSpawn();
    const proc = spawn(runner.command, [
      ...runner.prefixArgs,
      '-f', 'ba[ext=m4a]/ba',
      '--no-playlist',
      '--no-warnings',
      '-o', outputTemplate,
      url
    ]);

    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      if (code !== 0) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        return reject(new Error(`yt-dlp failed with exit code ${code}: ${stderr}`));
      }

      // Find downloaded file
      const files = fs.readdirSync(tempDir);
      if (files.length === 0) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        return reject(new Error('No audio file was created by yt-dlp'));
      }

      const downloadedFileName = files[0];
      const filePath = path.join(tempDir, downloadedFileName);
      const ext = path.extname(downloadedFileName).toLowerCase();
      const mimeType = ext === '.m4a' ? 'audio/mp4' : (ext === '.webm' ? 'audio/webm' : 'audio/mpeg');

      const fileBuffer = fs.readFileSync(filePath);
      const fileSize = fileBuffer.length;

      // Clean up temp file
      try {
        fs.rmSync(tempDir, { recursive: true, force: true });
      } catch (cleanErr) {
        console.warn('Temp cleanup warning:', cleanErr);
      }

      resolve({
        buffer: fileBuffer,
        mimeType: mimeType,
        size: fileSize,
        extension: ext.replace('.', '')
      });
    });
  });
}

/**
 * Search YouTube for songs and return rich metadata list
 */
export async function searchYouTube(query, limit = 8) {
  if (!query || !query.trim()) return [];
  const safeQuery = query.trim().replace(/"/g, '');
  const searchSpec = `ytsearch${limit}:${safeQuery}`;

  return new Promise((resolve) => {
    const baseCmd = getYtDlpExecCmd();
    const cmd = `${baseCmd} --flat-playlist --dump-json --no-warnings "${searchSpec}"`;
    exec(cmd, { maxBuffer: 15 * 1024 * 1024 }, (error, stdout) => {
      if (error && !stdout) {
        console.warn('yt-dlp search error:', error);
        return resolve([]);
      }

      const results = [];
      const lines = (stdout || '').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line.trim());
          if (!item.id) continue;

          // Only keep valid YouTube videos (11-character ID), strictly filter out channels and playlists
          if (!/^[a-zA-Z0-9_-]{11}$/.test(item.id)) continue;
          if (item._type === 'channel' || item._type === 'playlist') continue;
          if (item.url && (item.url.includes('/channel/') || item.url.includes('/user/') || item.url.includes('/@'))) continue;
          
          // Clean title
          const cleanTitle = (item.title || '')
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?(official|video|audio|remaster|hd|4k).*?\)/gi, '')
            .replace(/official (music )?video/gi, '')
            .replace(/lyrics?/gi, '')
            .trim();

          // Duration formatting
          const sec = item.duration || 0;
          const mins = Math.floor(sec / 60);
          const secs = Math.floor(sec % 60);
          const durationStr = sec > 0 ? `${mins}:${secs < 10 ? '0' : ''}${secs}` : (item.duration_string || '3:00');

          // Best thumbnail
          let thumb = item.thumbnail;
          if (item.thumbnails && item.thumbnails.length > 0) {
            thumb = item.thumbnails[item.thumbnails.length - 1].url || item.thumbnail;
          }
          if (!thumb) {
            thumb = `https://i.ytimg.com/vi/${item.id}/hqdefault.jpg`;
          }

          results.push({
            id: item.id,
            title: cleanTitle || item.title || 'YouTube Track',
            artist: item.uploader || item.channel || 'YouTube Artist',
            duration: sec,
            durationString: durationStr,
            thumbnail: thumb,
            url: item.url || `https://www.youtube.com/watch?v=${item.id}`
          });
        } catch {
          // ignore parse error for individual line
        }
      }

      resolve(results);
    });
  });
}
