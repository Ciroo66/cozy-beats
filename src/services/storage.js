/**
 * Offline Audio Storage Service using IndexedDB.
 * Allows downloading and permanently saving full audio files (Blobs),
 * metadata, cover art, and user favorites directly in device storage.
 */

const DB_NAME = 'CozyBeats_OfflineDB';
const DB_VERSION = 2;
const STORE_NAME = 'tracks';
const META_STORE = 'settings';
const PLAYLISTS_STORE = 'playlists';

function openDB() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const trackStore = db.createObjectStore(STORE_NAME, { keyPath: 'id' });
        trackStore.createIndex('title', 'title', { unique: false });
        trackStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
      if (!db.objectStoreNames.contains(META_STORE)) {
        db.createObjectStore(META_STORE, { keyPath: 'key' });
      }
      if (!db.objectStoreNames.contains(PLAYLISTS_STORE)) {
        const playlistStore = db.createObjectStore(PLAYLISTS_STORE, { keyPath: 'id' });
        playlistStore.createIndex('name', 'name', { unique: false });
        playlistStore.createIndex('createdAt', 'createdAt', { unique: false });
      }
    };

    request.onsuccess = (event) => resolve(event.target.result);
    request.onerror = (event) => reject(event.target.error);
  });
}

/**
 * Save an audio track and its binary blob into IndexedDB
 * @param {Object} track
 * @param {Blob} audioBlob
 */
export async function saveTrackOffline(track, audioBlob) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);

    const record = {
      id: track.id || 'track_' + Date.now() + '_' + Math.random().toString(36).substr(2, 6),
      title: track.title || 'Untitled Chill Beat',
      artist: track.artist || 'Cozy Artist',
      duration: track.duration || 0,
      genre: track.genre || 'Lofi / Chill',
      coverArt: track.coverArt || null,
      cozyColor: track.cozyColor || '#9c6644',
      cozyVibe: track.cozyVibe || 'warm tea & quiet night',
      fileSize: audioBlob.size,
      mimeType: audioBlob.type || 'audio/mpeg',
      audioBlob: audioBlob,
      createdAt: Date.now(),
      isFavorite: !!track.isFavorite
    };

    const req = store.put(record);
    req.onsuccess = () => resolve(record);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Download a remote audio URL and save it directly into IndexedDB
 * @param {Object} trackInfo { id, title, artist, url, coverArt, ... }
 * @param {Function} onProgress (percent) => void
 */
export async function downloadAndSaveTrack(trackInfo, onProgress) {
  const response = await fetch(trackInfo.url);
  if (!response.ok) {
    throw new Error(`Failed to download track (${response.statusText})`);
  }

  const contentLength = response.headers.get('content-length');
  const total = contentLength ? parseInt(contentLength, 10) : 0;

  let loaded = 0;
  let blob;

  if (response.body && total && onProgress) {
    const reader = response.body.getReader();
    const chunks = [];
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      chunks.push(value);
      loaded += value.length;
      onProgress(Math.min(100, Math.round((loaded / total) * 100)));
    }
    blob = new Blob(chunks, { type: response.headers.get('content-type') || 'audio/mpeg' });
  } else {
    blob = await response.blob();
    if (onProgress) onProgress(100);
  }

  return await saveTrackOffline(trackInfo, blob);
}

/**
 * Get all offline saved tracks
 */
export async function getAllOfflineTracks() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.getAll();

    req.onsuccess = () => {
      // Sort with newest first
      const tracks = req.result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      resolve(tracks);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Check if a track is already saved offline
 */
export async function isTrackSaved(trackId) {
  if (!trackId) return false;
  const db = await openDB();
  return new Promise((resolve) => {
    const tx = db.transaction([STORE_NAME], 'readonly');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(trackId);
    req.onsuccess = () => resolve(!!req.result);
    req.onerror = () => resolve(false);
  });
}

/**
 * Delete a track from offline storage
 */
export async function deleteOfflineTrack(trackId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.delete(trackId);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Toggle favorite status
 */
export async function toggleTrackFavorite(trackId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([STORE_NAME], 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    const req = store.get(trackId);

    req.onsuccess = () => {
      const track = req.result;
      if (track) {
        track.isFavorite = !track.isFavorite;
        store.put(track);
        resolve(track.isFavorite);
      } else {
        resolve(false);
      }
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get device storage usage estimate (in MB)
 */
export async function getStorageEstimate() {
  if (navigator.storage && navigator.storage.estimate) {
    try {
      const { usage, quota } = await navigator.storage.estimate();
      return {
        usageMB: (usage / (1024 * 1024)).toFixed(1),
        quotaMB: (quota / (1024 * 1024)).toFixed(0),
        usagePercent: quota ? ((usage / quota) * 100).toFixed(1) : 0
      };
    } catch {
      return null;
    }
  }
  return null;
}

/* ==========================================================================
   PLAYLIST / MIXTAPE PERSISTENCE
   ========================================================================== */

/**
 * Create a new custom playlist / mixtape
 */
export async function createPlaylist({ name, description = '', color = '#b85d43', trackIds = [] }) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PLAYLISTS_STORE], 'readwrite');
    const store = tx.objectStore(PLAYLISTS_STORE);

    const newPlaylist = {
      id: 'pl_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
      name: name.trim() || 'My Chill Mixtape',
      description: description.trim() || 'cozy beats & relaxing vibes',
      color: color,
      trackIds: trackIds, // array of track.id
      createdAt: Date.now(),
      updatedAt: Date.now()
    };

    const req = store.add(newPlaylist);
    req.onsuccess = () => resolve(newPlaylist);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Get all playlists
 */
export async function getAllPlaylists() {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PLAYLISTS_STORE], 'readonly');
    const store = tx.objectStore(PLAYLISTS_STORE);
    const req = store.getAll();

    req.onsuccess = () => {
      const playlists = req.result.sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));
      resolve(playlists);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Update an existing playlist
 */
export async function updatePlaylist(playlist) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PLAYLISTS_STORE], 'readwrite');
    const store = tx.objectStore(PLAYLISTS_STORE);
    playlist.updatedAt = Date.now();
    const req = store.put(playlist);
    req.onsuccess = () => resolve(playlist);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Delete a playlist
 */
export async function deletePlaylist(playlistId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PLAYLISTS_STORE], 'readwrite');
    const store = tx.objectStore(PLAYLISTS_STORE);
    const req = store.delete(playlistId);
    req.onsuccess = () => resolve(true);
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Add a track to a playlist
 */
export async function addTrackToPlaylist(playlistId, trackId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PLAYLISTS_STORE], 'readwrite');
    const store = tx.objectStore(PLAYLISTS_STORE);
    const req = store.get(playlistId);

    req.onsuccess = () => {
      const pl = req.result;
      if (!pl) return resolve(false);
      if (!pl.trackIds) pl.trackIds = [];
      if (!pl.trackIds.includes(trackId)) {
        pl.trackIds.push(trackId);
        pl.updatedAt = Date.now();
        store.put(pl);
        resolve(true);
      } else {
        resolve(false); // already exists
      }
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

/**
 * Remove a track from a playlist
 */
export async function removeTrackFromPlaylist(playlistId, trackId) {
  const db = await openDB();
  return new Promise((resolve, reject) => {
    const tx = db.transaction([PLAYLISTS_STORE], 'readwrite');
    const store = tx.objectStore(PLAYLISTS_STORE);
    const req = store.get(playlistId);

    req.onsuccess = () => {
      const pl = req.result;
      if (!pl) return resolve(false);
      pl.trackIds = (pl.trackIds || []).filter((id) => id !== trackId);
      pl.updatedAt = Date.now();
      store.put(pl);
      resolve(true);
    };
    req.onerror = (e) => reject(e.target.error);
  });
}

