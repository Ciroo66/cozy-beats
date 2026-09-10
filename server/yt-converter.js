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

const JUNK_AUDIO_PATTERNS = /\b(remix(es)?|sped\s*up|speed\s*up|speedup|slowed|reverb(ed)?|hoodtrap|nightcore|remake(s)?|mashup(s)?|mash\s*up|viral\s*version|viral\s*remix|viral\s*audio|tiktok\s*(version|audio|edit)|type\s*beat|beat\s*remake|bass\s*boost(ed)?|8d\s*audio|instrumental|karaoke|tribute|1\s*hour|10\s*hours|loop|hour\s*loop|compilation|full\s*album|covers?|parody|drill\s*remix|club\s*mix|pitch\s*shifted|pitched|mix|mixes|playlist)\b/i;
const NON_MUSIC_PATTERNS = /\b(jewellery|jewelry|earrings?\s*design|earrings?\s*collection|vlog|tutorial|how\s*to|diy|unboxing|fashion\s*haul|haul|review|reaction|gameplay|walkthrough)\b/i;

function cleanSongTitle(rawTitle) {
  return (rawTitle || '')
    .replace(/\s*[\(\[]\s*official\b.*?[\)\]]/gi, '')
    .replace(/\s*[\(\[]\s*(visualizer|lyrics?|lyric\s*video|audio|hd|4k|mv|music\s*video).*?[\)\]]/gi, '')
    .replace(/\s*[\(\[](sub\.?|traducida|letra|español|english\s*sub|romanized|color\s*coded).*?[\)\]]/gi, '')
    .replace(/\s*(\||\/\/|~)\s*.*$/g, '')
    .replace(/official (music )?video/gi, '')
    .replace(/official audio/gi, '')
    .replace(/official visualizer/gi, '')
    .replace(/lyric video/gi, '')
    .replace(/lyrics video/gi, '')
    .replace(/lyrics?/gi, '')
    .replace(/\(\s*\)/g, '')
    .replace(/\[\s*\]/g, '')
    .replace(/\s*\|\|\s*$/g, '')
    .trim();
}

function parseArtistAndTitle(rawTitle, rawUploader) {
  const uploaderClean = (rawUploader || '')
    .replace(/\s*-\s*Topic$/i, '')
    .trim();

  const cleaned = cleanSongTitle(rawTitle);
  let finalArtist = uploaderClean;
  let finalTitle = cleaned;

  if (cleaned.includes(' - ')) {
    const parts = cleaned.split(' - ');
    const p0 = parts[0].trim();
    const p1 = parts.slice(1).join(' - ').trim();

    if (p1 && uploaderClean && uploaderClean.toLowerCase().includes(p1.toLowerCase())) {
      finalArtist = p1;
      finalTitle = p0;
    } else if (p0 && uploaderClean && uploaderClean.toLowerCase().includes(p0.toLowerCase())) {
      finalArtist = p0;
      finalTitle = p1;
    } else {
      finalArtist = p0;
      finalTitle = p1;
    }
  }

  finalTitle = finalTitle.replace(/^["'‘“](.*)["'’”]$/, '$1').trim();

  return {
    title: finalTitle || rawTitle || 'Cozy Track',
    artist: finalArtist || uploaderClean || 'Cozy Artist'
  };
}

/**
 * Execute search query using yt-dlp flat playlist dump
 */
function queryYtDlpSearch(searchTarget) {
  return new Promise((resolve) => {
    const runner = getYtDlpSpawn();
    const proc = spawn(runner.command, [
      ...runner.prefixArgs,
      '--force-ipv4',
      '--flat-playlist',
      '--dump-json',
      '--no-warnings',
      searchTarget
    ]);

    let stdout = '';
    proc.stdout.on('data', (d) => { stdout += d.toString(); });
    proc.on('close', () => {
      const items = [];
      const lines = (stdout || '').split('\n');
      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const item = JSON.parse(line.trim());
          if (item.id || item.url) items.push(item);
        } catch {}
      }
      resolve(items);
    });
  });
}

/**
 * Rich authentic search prioritizing original studio tracks & verified artists
 */
export async function searchYouTube(query, limit = 10) {
  if (!query || !query.trim()) return [];
  const safeQuery = query.trim().replace(/"/g, '');
  const userWantsSpecial = JUNK_AUDIO_PATTERNS.test(safeQuery);

  // 1. Primary: Search YouTube first (contains verified artist channels, official videos & - Topic tracks)
  let rawItems = await queryYtDlpSearch(`ytsearch20:${safeQuery}`);

  // 2. Fallback to SoundCloud only if YouTube yielded 0 items
  let isSoundCloudFallback = false;
  if (rawItems.length === 0) {
    rawItems = await queryYtDlpSearch(`scsearch12:${safeQuery}`);
    isSoundCloudFallback = true;
  }

  const results = [];
  for (const item of rawItems) {
    try {
      const rawTitle = item.title || '';
      const sec = item.duration || 180;
      const rawChannel = item.channel || item.uploader || '';
      const isSoundCloud = isSoundCloudFallback || item.extractor === 'soundcloud' || (item.webpage_url && item.webpage_url.includes('soundcloud.com'));

      // Filter out remixes, remakes, loops, mixes, and non-music videos
      if (!userWantsSpecial) {
        if (JUNK_AUDIO_PATTERNS.test(rawTitle)) continue;
        if (JUNK_AUDIO_PATTERNS.test(rawChannel)) continue;
        if (NON_MUSIC_PATTERNS.test(rawTitle) || NON_MUSIC_PATTERNS.test(rawChannel)) continue;
        if (/\s+[xX]\s+/.test(rawTitle) && !/\b[xX]\b/.test(safeQuery)) continue;
        if (sec > 660 || sec < 35) continue; // Standard songs: 35s to 11min
      }

      const { title, artist } = parseArtistAndTitle(rawTitle, rawChannel);
      const videoId = item.id || Math.random().toString(36).substring(2, 9);
      const trackUrl = item.webpage_url || item.url || (isSoundCloud ? item.url : `https://www.youtube.com/watch?v=${videoId}`);

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

      // Authenticity & Official Artist Scoring
      let score = 0;
      const chanLower = rawChannel.toLowerCase();
      const artLower = artist.toLowerCase();

      if (item.channel_is_verified) score += 60;
      if (rawChannel.endsWith('- Topic')) score += 50;
      if (chanLower === artLower || (artLower.length > 2 && chanLower.includes(artLower))) score += 45;
      if (/official (music )?video|official audio/i.test(rawTitle)) score += 30;
      if (chanLower.includes('vevo')) score += 25;
      if (item.view_count && item.view_count > 1000000) score += 20;
      if (sec >= 110 && sec <= 360) score += 10;
      if (/lyrics|vibes|hype|sounds|edits|aesthetic|tiktok/i.test(chanLower)) score -= 20;

      results.push({
        id: isSoundCloud ? 'sc_' + item.id : videoId,
        title,
        artist,
        channel: rawChannel,
        duration: Math.round(sec),
        durationString: durationStr,
        thumbnail: thumb,
        url: trackUrl,
        source: isSoundCloud ? 'soundcloud' : 'youtube',
        isFullSong: true,
        score
      });
    } catch {}
  }

  // Sort descending by authenticity score so original songs by real artists are top results
  results.sort((a, b) => b.score - a.score);

  return results.slice(0, limit);
}
