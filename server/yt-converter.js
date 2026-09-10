import { spawn } from 'child_process';
import fs from 'fs';
import path from 'path';
import os from 'os';

const getYtDlpSpawn = () => {
  if (process.platform === 'win32') {
    return { command: 'python', prefixArgs: ['-m', 'yt_dlp'] };
  }
  return { command: 'yt-dlp', prefixArgs: [] };
};

/**
 * Get video metadata quickly via oEmbed or yt-dlp
 */
export async function getYouTubeInfo(url) {
  // 1. Fast public oEmbed (works on ALL cloud IPs without bot detection)
  let oembedData = null;
  try {
    const oembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(url)}`);
    if (oembedRes.ok) {
      oembedData = await oembedRes.json();
    }
  } catch (err) {
    console.warn('oEmbed fetch error:', err);
  }

  // 2. yt-dlp inspection
  return new Promise((resolve, reject) => {
    const runner = getYtDlpSpawn();
    const proc = spawn(runner.command, [
      ...runner.prefixArgs,
      '--extractor-args', 'youtube:player_client=visionos,android',
      '--force-ipv4',
      '--no-check-certificates',
      '--skip-download',
      '--dump-json',
      '--no-warnings',
      url
    ]);

    let stdout = '';
    let stderr = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.stderr.on('data', (d) => { stderr += d.toString(); });

    proc.on('close', (code) => {
      if (code !== 0 || !stdout.trim()) {
        if (oembedData && oembedData.title) {
          return resolve({
            title: oembedData.title,
            artist: oembedData.author_name || 'YouTube Audio',
            duration: 180,
            thumbnail: oembedData.thumbnail_url,
            url: url
          });
        }
        return reject(new Error(stderr || 'yt-dlp failed to inspect video'));
      }

      try {
        const info = JSON.parse(stdout.trim().split('\n')[0]);
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
 * Low-level audio downloader
 */
function executeAudioDownload(target) {
  const tempDir = path.join(os.tmpdir(), 'cozy_beats_dl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7));
  fs.mkdirSync(tempDir, { recursive: true });
  const outputTemplate = path.join(tempDir, '%(id)s.%(ext)s');

  return new Promise((resolve, reject) => {
    const runner = getYtDlpSpawn();
    const isSearchQuery = target.startsWith('scsearch') || target.startsWith('ytsearch');
    
    const args = [
      ...runner.prefixArgs,
      '--force-ipv4',
      '--no-check-certificates',
      '--geo-bypass',
      '-f', 'ba/ba[ext=m4a]/18/b',
      '--extract-audio',
      '--audio-format', 'm4a',
      '--no-warnings'
    ];

    if (isSearchQuery) {
      args.push('--ignore-errors', '--max-downloads', '1');
    } else {
      args.push('--no-playlist');
      args.push('--extractor-args', 'youtube:player_client=visionos,android');
    }

    args.push('-o', outputTemplate, target);

    const proc = spawn(runner.command, args);

    let stderr = '';
    proc.stderr.on('data', (d) => {
      stderr += d.toString();
    });

    proc.on('close', (code) => {
      // 1. Check if a valid audio file was successfully downloaded (even if yt-dlp exited with code 1 or 101 due to --max-downloads abort)
      let files = [];
      try { files = fs.readdirSync(tempDir); } catch {}
      if (files.length > 0) {
        const downloadedFileName = files[0];
        const filePath = path.join(tempDir, downloadedFileName);
        try {
          const stat = fs.statSync(filePath);
          if (stat.size > 8000) { // Valid audio file > 8KB
            const ext = path.extname(downloadedFileName).toLowerCase();
            const mimeType = ext === '.m4a' ? 'audio/mp4' : (ext === '.webm' ? 'audio/webm' : (ext === '.mp3' ? 'audio/mpeg' : 'audio/mp4'));
            const fileBuffer = fs.readFileSync(filePath);
            const fileSize = fileBuffer.length;
            try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
            return resolve({
              buffer: fileBuffer,
              mimeType: mimeType,
              size: fileSize,
              extension: ext.replace('.', '')
            });
          }
        } catch {}
      }

      if (code !== 0) {
        try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
        return reject(new Error(`Download failed with code ${code}: ${stderr}`));
      }

      try { fs.rmSync(tempDir, { recursive: true, force: true }); } catch {}
      return reject(new Error('No audio file was created by downloader'));
    });
  });
}

/**
 * Bulletproof audio download with seamless cloud fallback
 */
export async function downloadYouTubeAudio(url, trackTitle = '', trackArtist = '') {
  let title = trackTitle;
  let artist = trackArtist;

  // Fetch title & artist via oEmbed first so we have the metadata ready for fallback
  try {
    const info = await getYouTubeInfo(url);
    if (info) {
      if (!title) title = info.title;
      if (!artist) artist = info.artist;
    }
  } catch {}

  // 1. Try direct stream download
  try {
    console.log(`[Cloud Converter] Downloading direct audio: ${url}`);
    return await executeAudioDownload(url);
  } catch (ytErr) {
    console.warn(`[Cloud Converter] Direct stream blocked or unavailable: ${ytErr.message}`);

    // 2. Seamless studio cloud fallback: SoundCloud search with DRM skip (searches top 5, skips DRM)
    const cleanSearch = (title || '')
      .replace(/\[.*?\]/g, '')
      .replace(/\(.*?(official|video|audio|remaster|hd|4k).*?\)/gi, '')
      .replace(/official (music )?video/gi, '')
      .replace(/lyrics?/gi, '')
      .trim();

    const fallbackQuery = `${cleanSearch} ${artist || ''}`.trim();
    if (fallbackQuery) {
      console.log(`[Cloud Converter] Resolving via cloud studio fallback 1: "${fallbackQuery}"`);
      try {
        return await executeAudioDownload(`scsearch5:${fallbackQuery}`);
      } catch (fallbackErr) {
        console.warn(`[Cloud Converter] Fallback 1 failed: ${fallbackErr.message}`);
      }

      // 3. Secondary fallback: search track name only
      console.log(`[Cloud Converter] Resolving via cloud studio fallback 2: "${cleanSearch}"`);
      try {
        return await executeAudioDownload(`scsearch5:${cleanSearch}`);
      } catch (fallbackErr2) {
        console.warn(`[Cloud Converter] Fallback 2 failed: ${fallbackErr2.message}`);
      }
    }

    throw ytErr;
  }
}

/**
 * Rich multi-source search (YouTube + SoundCloud)
 */
export async function searchYouTube(query, limit = 8) {
  if (!query || !query.trim()) return [];
  const safeQuery = query.trim().replace(/"/g, '');

  return new Promise((resolve) => {
    const runner = getYtDlpSpawn();
    // Search both SoundCloud (100% reliable on datacenters) and YouTube
    const proc = spawn(runner.command, [
      ...runner.prefixArgs,
      '--force-ipv4',
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      `scsearch${Math.ceil(limit / 2)}:${safeQuery}`,
      `ytsearch${Math.ceil(limit / 2)}:${safeQuery}`
    ]);

    let stdout = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });

    proc.on('close', () => {
      const results = [];
      const lines = (stdout || '').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line.trim());
          if (!item.id && !item.url) continue;

          const isSoundCloud = item.extractor === 'soundcloud' || (item.webpage_url && item.webpage_url.includes('soundcloud.com'));
          const videoId = item.id || Math.random().toString(36).substring(2, 9);
          const trackUrl = item.webpage_url || item.url || (isSoundCloud ? item.url : `https://www.youtube.com/watch?v=${videoId}`);

          const cleanTitle = (item.title || '')
            .replace(/\[.*?\]/g, '')
            .replace(/\(.*?(official|video|audio|remaster|hd|4k).*?\)/gi, '')
            .replace(/official (music )?video/gi, '')
            .replace(/lyrics?/gi, '')
            .trim();

          const sec = item.duration || 180;
          const mins = Math.floor(sec / 60);
          const secs = Math.floor(sec % 60);
          const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

          let thumb = item.thumbnail;
          if (item.thumbnails && item.thumbnails.length > 0) {
            thumb = item.thumbnails[item.thumbnails.length - 1].url || item.thumbnail;
          }
          if (!thumb) {
            thumb = isSoundCloud ? '' : `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;
          }

          results.push({
            id: isSoundCloud ? 'sc_' + item.id : videoId,
            title: cleanTitle || item.title || 'Cozy Track',
            artist: item.uploader || item.artist || item.channel || 'Cozy Artist',
            duration: Math.round(sec),
            durationString: durationStr,
            thumbnail: thumb,
            url: trackUrl,
            source: isSoundCloud ? 'soundcloud' : 'youtube',
            isFullSong: true
          });
        } catch {}
      }

      resolve(results);
    });
  });
}
