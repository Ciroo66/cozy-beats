import React, { useState, useEffect } from 'react';
import { 
  Download, 
  X, 
  Check, 
  Loader2, 
  Clipboard, 
  Music, 
  Play, 
  Sparkles, 
  AlertCircle, 
  Clock, 
  Search,
  Wifi,
  Settings,
  Globe
} from 'lucide-react';
import YoutubeIcon from './YoutubeIcon';
import { saveTrackOffline } from '../services/storage';

const DEFAULT_GLOBAL_SERVER = 'https://cozy-beats.onrender.com';

const QUICK_TAGS = [
  '☕ Lofi Chill',
  '🌧️ Rainy Beats',
  '🎹 Cozy Piano',
  '🌃 Night Walk',
  '✨ Acoustic Guitar'
];

export default function YouTubeConverterModal({
  isOpen,
  onClose,
  onTrackSaved,
  onPlayNow
}) {
  const [searchInput, setSearchInput] = useState('');
  const [isSearching, setIsSearching] = useState(false);
  const [searchResults, setSearchResults] = useState([]);
  
  // Single link mode state
  const [videoInfo, setVideoInfo] = useState(null);
  const [customTitle, setCustomTitle] = useState('');
  const [customArtist, setCustomArtist] = useState('');
  const [isConvertingSingle, setIsConvertingSingle] = useState(false);
  const [conversionStep, setConversionStep] = useState('');
  const [completedSingleTrack, setCompletedSingleTrack] = useState(null);

  // Per-result downloading state: trackId -> boolean
  const [downloadingIds, setDownloadingIds] = useState({});
  const [savedTracksMap, setSavedTracksMap] = useState({}); // trackId -> savedRecord

  const [errorMsg, setErrorMsg] = useState('');

  // Permanent 24/7 cloud server bridge (works on ANY network: 4G/5G, Wi-Fi worldwide)
  const [serverHost, setServerHost] = useState(() => {
    const saved = localStorage.getItem('cozy_converter_server');
    if (!saved || saved.includes('192.168.') || saved.includes('localhost') || saved.includes('127.0.0.1') || saved.includes('trycloudflare.com')) {
      try { localStorage.setItem('cozy_converter_server', DEFAULT_GLOBAL_SERVER); } catch {}
      return DEFAULT_GLOBAL_SERVER;
    }
    return saved;
  });
  const [showServerConfig, setShowServerConfig] = useState(false);

  useEffect(() => {
    if (!isOpen) {
      // Reset state on close
      setSearchInput('');
      setSearchResults([]);
      setVideoInfo(null);
      setErrorMsg('');
      setIsConvertingSingle(false);
      setCompletedSingleTrack(null);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  // Determine base URL for API requests (guarantees APK and Browser work identically)
  const getApiBase = () => {
    // Only use relative URL if strictly running on local PC Vite server (port 5173)
    const isLocalPCDev = window.location.hostname === 'localhost' && window.location.port === '5173';
    if (isLocalPCDev) {
      return '';
    }

    // Everywhere else (Android APK on any network, remote phone, etc.):
    const host = (serverHost || DEFAULT_GLOBAL_SERVER).trim().replace(/\/+$/, '');
    if (!host || host.includes('192.168.') || host.includes('localhost') || host.includes('127.0.0.1')) {
      return DEFAULT_GLOBAL_SERVER;
    }
    return host;
  };

  // Paste from clipboard helper
  const handlePasteClipboard = async () => {
    try {
      if (navigator.clipboard && navigator.clipboard.readText) {
        const text = await navigator.clipboard.readText();
        if (text) {
          setSearchInput(text.trim());
          handleProcessInput(text.trim());
        }
      }
    } catch {
      // Clipboard access denied
    }
  };

  // Inspect a specific YouTube URL
  const fetchSingleVideoInfo = async (targetUrl) => {
    try {
      setIsSearching(true);
      setErrorMsg('');
      setVideoInfo(null);
      setSearchResults([]);
      setCompletedSingleTrack(null);

      let data = null;

      // 1. Direct public noembed (works anywhere on mobile phone with 0 backend dependencies)
      try {
        const oembedRes = await fetch(`https://noembed.com/embed?url=${encodeURIComponent(targetUrl)}`, {
          signal: AbortSignal.timeout(5000)
        });
        if (oembedRes.ok) {
          const oembed = await oembedRes.json();
          if (oembed && oembed.title) {
            data = {
              title: oembed.title,
              artist: oembed.author_name || 'YouTube Artist',
              duration: 180,
              thumbnail: oembed.thumbnail_url,
              url: targetUrl
            };
          }
        }
      } catch (oembedErr) {
        console.warn('noembed fallback skipped:', oembedErr);
      }

      // 2. If noembed missed, try server bridge
      if (!data) {
        try {
          const apiBase = getApiBase();
          const res = await fetch(`${apiBase}/api/yt-info?url=${encodeURIComponent(targetUrl)}`, {
            signal: AbortSignal.timeout(4000)
          });
          const contentType = res.headers.get('content-type') || '';
          if (res.ok && contentType.includes('application/json')) {
            const serverData = await res.json();
            if (serverData && !serverData.error) {
              data = serverData;
            }
          }
        } catch (serverErr) {
          console.warn('server bridge info lookup skipped:', serverErr);
        }
      }

      if (!data || !data.title) {
        throw new Error('Could not find video details. Please verify the YouTube link.');
      }

      setVideoInfo(data);
      const cleanTitle = (data.title || '')
        .replace(/\[.*?\]/g, '')
        .replace(/\(.*?\)/g, '')
        .replace(/official (music )?video/gi, '')
        .replace(/lyrics?/gi, '')
        .replace(/audio/gi, '')
        .replace(/4k remaster/gi, '')
        .trim();

      setCustomTitle(cleanTitle || data.title);
      setCustomArtist(data.artist || 'YouTube Artist');
    } catch (err) {
      console.error('Fetch info error:', err);
      setErrorMsg(err.message || 'Failed to inspect YouTube link.');
    } finally {
      setIsSearching(false);
    }
  };

  // Search for songs (Direct YouTube search is primary)
  const handleSearchKeywords = async (keywords) => {
    try {
      setIsSearching(true);
      setErrorMsg('');
      setVideoInfo(null);
      setCompletedSingleTrack(null);

      let foundTracks = [];

      // Step 1: Direct YouTube Search (primary, finds exact songs & artists on YouTube)
      try {
        const apiBase = getApiBase();
        const res = await fetch(`${apiBase}/api/yt-search?q=${encodeURIComponent(keywords)}`, {
          signal: AbortSignal.timeout(25000)
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.ok && contentType.includes('application/json')) {
          const data = await res.json();
          if (data.results && data.results.length > 0) {
            foundTracks = data.results.map((r) => ({ ...r, source: 'youtube', isFullSong: true }));
          }
        }
      } catch (serverErr) {
        console.warn('YouTube search error:', serverErr);
      }

      // Step 2: If PC Bridge was unreachable on phone, search YouTube directly via public Piped API!
      if (foundTracks.length === 0) {
        try {
          const pipedRes = await fetch(
            `https://api.piped.private.coffee/search?q=${encodeURIComponent(keywords)}&filter=videos`,
            { signal: AbortSignal.timeout(7000) }
          );
          if (pipedRes.ok) {
            const pipedData = await pipedRes.json();
            if (pipedData.items && pipedData.items.length > 0) {
              foundTracks = pipedData.items
                .filter((item) => item.url && item.url.includes('/watch?v='))
                .slice(0, 10)
                .map((item) => {
                  const videoId = item.url.replace('/watch?v=', '');
                  const sec = item.duration || 180;
                  const mins = Math.floor(sec / 60);
                  const secs = sec % 60;
                  const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;

                  return {
                    id: videoId,
                    title: item.title,
                    artist: item.uploaderName || 'YouTube Artist',
                    duration: sec,
                    durationString: durationStr,
                    thumbnail: item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                    url: `https://www.youtube.com/watch?v=${videoId}`,
                    source: 'youtube',
                    isFullSong: true
                  };
                });
            }
          }
        } catch (pipedErr) {
          console.warn('Piped YouTube search skipped:', pipedErr);
        }
      }

      // Step 3: Fallback to Cloud Music Search if both failed
      if (foundTracks.length === 0) {
        try {
          const audiusRes = await fetch(
            `https://api.audius.co/v1/tracks/search?query=${encodeURIComponent(keywords)}&app_name=CozyBeatsCassette`,
            { signal: AbortSignal.timeout(7000) }
          );
          if (audiusRes.ok) {
            const audiusData = await audiusRes.json();
            if (audiusData.data && audiusData.data.length > 0) {
              foundTracks = audiusData.data.map((item) => {
                const sec = item.duration || 180;
                const mins = Math.floor(sec / 60);
                const secs = sec % 60;
                const durationStr = `${mins}:${secs < 10 ? '0' : ''}${secs}`;
                const art = item.artwork?.['480x480'] || item.artwork?.['150x150'] || null;

                return {
                  id: 'aud_' + item.id,
                  title: item.title,
                  artist: item.user?.name || 'Cozy Artist',
                  duration: sec,
                  durationString: durationStr,
                  thumbnail: art,
                  audioUrl: `https://api.audius.co/v1/tracks/${item.id}/stream?app_name=CozyBeatsCassette`,
                  genre: item.genre || 'Full Song',
                  source: 'audius',
                  isFullSong: true
                };
              });
            }
          }
        } catch (cloudErr) {
          console.warn('Cloud search skipped:', cloudErr);
        }
      }

      if (foundTracks.length > 0) {
        setSearchResults(foundTracks);
      } else {
        setSearchResults([]);
        setErrorMsg('No songs found. Try different song titles or artist names.');
      }
    } catch (err) {
      console.error('Search error:', err);
      setErrorMsg('Search could not connect. Check internet connection and try again.');
    } finally {
      setIsSearching(false);
    }
  };

  // Handle submit from search input (detect URL vs plain text)
  const handleProcessInput = (explicitText) => {
    const text = (explicitText !== undefined ? explicitText : searchInput).trim();
    if (!text) return;

    if (text.includes('youtube.com') || text.includes('youtu.be')) {
      fetchSingleVideoInfo(text);
    } else {
      handleSearchKeywords(text);
    }
  };

  const handleFormSubmit = (e) => {
    e.preventDefault();
    handleProcessInput();
  };

  // 1-Tap Download any search result into IndexedDB offline storage
  const handleDownloadResultTrack = async (resultTrack) => {
    if (downloadingIds[resultTrack.id] || savedTracksMap[resultTrack.id]) return;

    try {
      setDownloadingIds((prev) => ({ ...prev, [resultTrack.id]: true }));
      setErrorMsg('');

      let audioBlob = null;

      // Method A: Direct Cloud Full Track Download (100% standalone on any network worldwide)
      if (resultTrack.audioUrl) {
        const streamRes = await fetch(resultTrack.audioUrl, {
          signal: AbortSignal.timeout(65000)
        });
        if (!streamRes.ok) {
          throw new Error(`Download failed (HTTP ${streamRes.status})`);
        }
        const rawBlob = await streamRes.blob();
        const headerType = streamRes.headers.get('content-type') || 'audio/mpeg';
        const finalMime = headerType.includes('audio') ? headerType : 'audio/mpeg';
        audioBlob = new Blob([rawBlob], { type: finalMime });
      } else {
        // Method B: YouTube Audio via Global Cloud Converter Bridge
        const apiBase = getApiBase();
        const targetUrl = resultTrack.url || `https://www.youtube.com/watch?v=${resultTrack.id}`;
        let downloadRes;
        try {
          downloadRes = await fetch(`${apiBase}/api/yt-download`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ url: targetUrl }),
            signal: AbortSignal.timeout(120000)
          });
        } catch {
          throw new Error(
            `Could not reach download server. Please check your internet connection and try again.`
          );
        }

        const contentType = downloadRes.headers.get('content-type') || '';
        if (!downloadRes.ok || contentType.includes('text/html')) {
          const errJson = await downloadRes.json().catch(() => ({}));
          throw new Error(errJson.error || `Download failed (HTTP ${downloadRes.status})`);
        }

        const rawBlob = await downloadRes.blob();
        const mimeType = downloadRes.headers.get('x-audio-mime') || downloadRes.headers.get('X-Audio-Mime') || 'audio/mp4';
        audioBlob = new Blob([rawBlob], { type: mimeType });
      }

      const newTrack = {
        id: 'track_' + resultTrack.id + '_' + Date.now(),
        title: resultTrack.title,
        artist: resultTrack.artist || 'Cozy Beats',
        duration: resultTrack.duration || 180,
        genre: resultTrack.genre || 'Offline Pocket Tape',
        cozyColor: '#a15b45',
        cozyVibe: '100% full song saved to offline tape box',
        coverArt: resultTrack.thumbnail || null
      };

      const savedRecord = await saveTrackOffline(newTrack, audioBlob);
      setSavedTracksMap((prev) => ({ ...prev, [resultTrack.id]: savedRecord }));
      if (onTrackSaved) onTrackSaved(savedRecord);
    } catch (err) {
      console.error('Download error:', err);
      setErrorMsg(err.message || 'Could not download track. Please try again.');
    } finally {
      setDownloadingIds((prev) => {
        const next = { ...prev };
        delete next[resultTrack.id];
        return next;
      });
    }
  };

  // Convert & save single inspected video URL
  const handleConvertSingleAndSave = async () => {
    if (!videoInfo) return;

    try {
      setIsConvertingSingle(true);
      setErrorMsg('');
      setConversionStep('Connecting to converter server...');

      const apiBase = getApiBase();
      let downloadRes;

      try {
        setConversionStep('Extracting audio from broadcast...');
        downloadRes = await fetch(`${apiBase}/api/yt-download`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ url: videoInfo?.url || searchInput }),
          signal: AbortSignal.timeout(90000)
        });
      } catch {
        throw new Error(
          `Cannot reach converter service. Please check your internet connection and try again.`
        );
      }

      const contentType = downloadRes.headers.get('content-type') || '';
      if (!downloadRes.ok || contentType.includes('text/html')) {
        const errJson = await downloadRes.json().catch(() => ({}));
        throw new Error(errJson.error || `Download failed with status ${downloadRes.status}`);
      }

      setConversionStep('Recording to offline pocket tape...');
      const rawBlob = await downloadRes.blob();
      const mimeType = downloadRes.headers.get('x-audio-mime') || downloadRes.headers.get('X-Audio-Mime') || 'audio/mp4';
      const audioBlob = new Blob([rawBlob], { type: mimeType });

      const finalTitle = customTitle.trim() || videoInfo?.title || 'YouTube Track';
      const finalArtist = customArtist.trim() || videoInfo?.artist || 'YouTube';

      const newTrack = {
        id: 'yt_' + (videoInfo?.id || Date.now()) + '_' + Math.random().toString(36).substring(2, 5),
        title: finalTitle,
        artist: finalArtist,
        duration: videoInfo?.duration || 0,
        genre: 'YouTube Dub',
        cozyColor: '#a15b45',
        cozyVibe: 'recorded from YouTube broadcast',
        coverArt: videoInfo?.thumbnail || null
      };

      const savedRecord = await saveTrackOffline(newTrack, audioBlob);
      setCompletedSingleTrack(savedRecord);
      if (onTrackSaved) onTrackSaved(savedRecord);
    } catch (err) {
      console.error('Conversion failed:', err);
      setErrorMsg(err.message || 'Could not convert audio. Connect to PC Wi-Fi for YouTube URLs.');
    } finally {
      setIsConvertingSingle(false);
      setConversionStep('');
    }
  };

  const formatSecs = (sec) => {
    if (!sec) return '0:00';
    const m = Math.floor(sec / 60);
    const s = Math.floor(sec % 60);
    return `${m}:${s < 10 ? '0' : ''}${s}`;
  };

  return (
    <div className="cozy-modal-backdrop" onClick={onClose}>
      <div className="cozy-modal-card yt-converter-modal" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="modal-header">
          <div className="modal-title-box">
            <div className="yt-badge-tag">
              <Globe size={14} className="text-red" />
              <span>ONLINE FULL SONG RECORDER</span>
            </div>
            <h3>Search Any Song & Save Offline</h3>
            <p className="modal-sub">Search & download 100% full-length songs on any Wi-Fi or data to keep in your Offline Box.</p>
          </div>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Unified Search & URL Input Form */}
        <form className="yt-input-group" onSubmit={handleFormSubmit}>
          <div className="yt-input-bar">
            <Search size={16} className="yt-search-icon" />
            <input
              type="text"
              placeholder="Search songs, artists, or paste link..."
              value={searchInput}
              onChange={(e) => setSearchInput(e.target.value)}
              className="yt-text-input"
              disabled={isSearching || isConvertingSingle}
            />
            {searchInput ? (
              <button 
                type="button" 
                className="yt-clear-btn"
                onClick={() => {
                  setSearchInput('');
                  setSearchResults([]);
                  setVideoInfo(null);
                  setErrorMsg('');
                }}
              >
                ✕
              </button>
            ) : (
              <button 
                type="button" 
                className="yt-paste-btn"
                onClick={handlePasteClipboard}
                title="Paste from clipboard"
              >
                <Clipboard size={14} /> Paste
              </button>
            )}
          </div>

          <button 
            type="submit" 
            className="yt-inspect-btn"
            disabled={!searchInput || isSearching || isConvertingSingle}
          >
            {isSearching ? (
              <>
                <Loader2 size={14} className="spin" /> Searching...
              </>
            ) : (
              'Search & Find'
            )}
          </button>
        </form>

        {/* Quick Vibe Suggestions Chips */}
        {!videoInfo && searchResults.length === 0 && !completedSingleTrack && (
          <div className="yt-quick-chips-row">
            {QUICK_TAGS.map((tag) => (
              <button
                key={tag}
                type="button"
                className="yt-quick-chip"
                onClick={() => {
                  const cleaned = tag.replace(/^[^\w]+/, '').trim();
                  setSearchInput(cleaned);
                  handleSearchKeywords(cleaned);
                }}
              >
                {tag}
              </button>
            ))}
          </div>
        )}

        {/* Error Alert */}
        {errorMsg && (
          <div className="error-alert">
            <AlertCircle size={15} /> {errorMsg}
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 1: SEARCH RESULTS LIST WITH 1-TAP SAVE BUTTONS       */}
        {/* ========================================================= */}
        {searchResults.length > 0 && !videoInfo && (
          <div className="yt-search-results-box">
            <div className="search-results-header">
              <span>Matching Songs ({searchResults.length})</span>
              <span className="search-results-hint">Tap to save offline</span>
            </div>

            <div className="yt-search-results-list">
              {searchResults.map((item) => {
                const isDownloading = !!downloadingIds[item.id];
                const savedRecord = savedTracksMap[item.id];

                return (
                  <div key={item.id} className="yt-result-card">
                    <div className="result-thumb-box">
                      <img src={item.thumbnail} alt={item.title} className="result-thumb" />
                      {item.durationString && (
                        <span className="result-duration-badge">{item.durationString}</span>
                      )}
                    </div>

                    <div className="result-meta">
                      <h4 className="result-title">{item.title}</h4>
                      <p className="result-artist">
                        <span>{item.artist}</span>
                        {item.isFullSong && <span className="full-track-tag">Full Track</span>}
                      </p>
                    </div>

                    <div className="result-action">
                      {savedRecord ? (
                        <div className="result-saved-actions">
                          <span className="saved-check-tag">
                            <Check size={12} /> In Box
                          </span>
                          <button
                            className="result-play-btn"
                            onClick={() => {
                              if (onPlayNow) onPlayNow(savedRecord);
                              onClose();
                            }}
                            title="Play on Cassette Deck"
                          >
                            <Play size={13} fill="#fff" /> Play
                          </button>
                        </div>
                      ) : (
                        <button
                          className={`result-download-btn ${isDownloading ? 'is-busy' : ''}`}
                          onClick={() => handleDownloadResultTrack(item)}
                          disabled={isDownloading}
                        >
                          {isDownloading ? (
                            <>
                              <Loader2 size={13} className="spin" /> Saving...
                            </>
                          ) : (
                            <>
                              <Download size={13} /> Save to Box
                            </>
                          )}
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* ========================================================= */}
        {/* VIEW 2: SINGLE VIDEO URL INSPECTED (MANUAL TAG EDITING)  */}
        {/* ========================================================= */}
        {videoInfo && !completedSingleTrack && (
          <div className="yt-preview-card">
            <div className="yt-thumb-wrapper">
              <img src={videoInfo.thumbnail} alt={videoInfo.title} className="yt-preview-thumb" />
              <div className="yt-duration-badge">
                <Clock size={11} /> {formatSecs(videoInfo.duration)}
              </div>
            </div>

            <div className="yt-metadata-edit-box">
              <div className="edit-field">
                <label>Track Title</label>
                <input
                  type="text"
                  value={customTitle}
                  onChange={(e) => setCustomTitle(e.target.value)}
                  className="cozy-edit-input"
                  placeholder="Song Title"
                  disabled={isConvertingSingle}
                />
              </div>

              <div className="edit-field">
                <label>Artist / Creator</label>
                <input
                  type="text"
                  value={customArtist}
                  onChange={(e) => setCustomArtist(e.target.value)}
                  className="cozy-edit-input"
                  placeholder="Artist Name"
                  disabled={isConvertingSingle}
                />
              </div>
            </div>

            {isConvertingSingle ? (
              <div className="converting-status-box">
                <div className="converting-tape-animation">
                  <span className="mini-cog spin">⚙</span>
                  <div className="converting-tape-ribbon"></div>
                  <span className="mini-cog spin">⚙</span>
                </div>
                <div className="converting-text">{conversionStep}</div>
                <div className="converting-sub">Downloading audio & saving to phone storage...</div>
              </div>
            ) : (
              <button 
                className="record-tape-cta-btn"
                onClick={handleConvertSingleAndSave}
              >
                <Download size={17} /> Record to Pocket Storage
              </button>
            )}
          </div>
        )}

        {/* Single Video Success State */}
        {completedSingleTrack && (
          <div className="yt-success-card">
            <div className="success-icon-badge">
              <Check size={28} color="#fff" />
            </div>
            <h4>Dubbed to Tape Successfully!</h4>
            <p className="success-track-name">
              <strong>{completedSingleTrack.title}</strong> by {completedSingleTrack.artist}
            </p>
            <p className="success-sub">
              Saved offline in your app storage ({((completedSingleTrack.fileSize || 0) / (1024 * 1024)).toFixed(1)} MB). Ready to play without internet!
            </p>

            <div className="success-actions-row">
              <button 
                className="success-play-btn"
                onClick={() => {
                  if (onPlayNow) onPlayNow(completedSingleTrack);
                  onClose();
                }}
              >
                <Play size={16} fill="#fff" /> Listen on Tape Deck
              </button>
              <button 
                className="success-another-btn"
                onClick={() => {
                  setSearchInput('');
                  setVideoInfo(null);
                  setCompletedSingleTrack(null);
                }}
              >
                Find Another Song
              </button>
            </div>
          </div>
        )}

        {/* Helpful Info footer */}
        {!videoInfo && searchResults.length === 0 && !completedSingleTrack && (
          <div className="yt-help-tips">
            <div className="tip-header">
              <Sparkles size={14} className="text-amber" />
              <span>How it works:</span>
            </div>
            <p>1. Type any song title or artist name above, or paste a link.</p>
            <p>2. Tap <strong>Search & Find</strong> to see matching songs instantly on any network.</p>
            <p>3. Tap <strong>Save to Box</strong> to store it in your offline pocket library forever.</p>
          </div>
        )}

        {/* Cloud Converter Bridge Settings Toggle (Works Anywhere) */}
        <div className="yt-server-bridge-row">
          <button 
            type="button" 
            className="bridge-toggle-btn"
            onClick={() => setShowServerConfig(!showServerConfig)}
          >
            <Globe size={13} style={{ color: '#387038' }} />
            <span>Cloud Converter: Global Online (Any Network)</span>
            <Settings size={12} style={{ marginLeft: 'auto' }} />
          </button>

          {showServerConfig && (
            <div className="bridge-config-panel">
              <label className="bridge-label">Converter Server URL:</label>
              <div className="bridge-input-row">
                <input 
                  type="text" 
                  value={serverHost} 
                  onChange={(e) => {
                    setServerHost(e.target.value);
                    localStorage.setItem('cozy_converter_server', e.target.value);
                  }}
                  placeholder={DEFAULT_GLOBAL_SERVER}
                  className="bridge-input"
                />
                <button
                  type="button"
                  className="bridge-reset-btn"
                  onClick={() => {
                    setServerHost(DEFAULT_GLOBAL_SERVER);
                    localStorage.setItem('cozy_converter_server', DEFAULT_GLOBAL_SERVER);
                  }}
                  title="Reset to default cloud server"
                >
                  Reset
                </button>
              </div>
              <p className="bridge-hint">
                Connected to global high-speed cloud tunnel. Works from anywhere on 4G, 5G, or Wi-Fi.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
