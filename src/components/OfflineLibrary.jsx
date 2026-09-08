import React, { useState, useRef } from 'react';
import { 
  HardDrive, 
  Trash2, 
  Play, 
  Pause, 
  Upload, 
  Plus, 
  Search, 
  Heart, 
  Music, 
  FileAudio, 
  Sparkles,
  AlertCircle,
  ListPlus,
  Radio,
  ArrowLeft,
  Edit3
} from 'lucide-react';
import YoutubeIcon from './YoutubeIcon';
import AddToPlaylistModal from './AddToPlaylistModal';
import { saveTrackOffline } from '../services/storage';

export default function OfflineLibrary({
  tracks = [],
  currentTrack,
  isPlaying,
  storageInfo,
  onPlayTrack,
  onDeleteTrack,
  onToggleFavorite,
  onTrackImported,
  onOpenDiscover,
  onOpenYouTubeConverter,
  playlists = [],
  onPlayPlaylist,
  onOpenCreatePlaylist,
  onOpenEditPlaylist,
  onDeletePlaylist,
  onToggleTrackInPlaylist,
  onRemoveTrackFromPlaylist
}) {
  const [activeSubTab, setActiveSubTab] = useState('tracks'); // 'tracks' | 'mixtapes'
  const [selectedPlaylistId, setSelectedPlaylistId] = useState(null);
  const [trackToAddToPlaylist, setTrackToAddToPlaylist] = useState(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [filterFavorite, setFilterFavorite] = useState(false);
  const [customUrl, setCustomUrl] = useState('');
  const [isDownloadingUrl, setIsDownloadingUrl] = useState(false);
  const [showUrlInput, setShowUrlInput] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const fileInputRef = useRef(null);

  // Selected playlist object
  const selectedPlaylist = playlists.find((p) => p.id === selectedPlaylistId) || null;

  // Filtered tracks for main list
  const filteredTracks = tracks.filter((t) => {
    const matchesSearch = t.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
                          t.artist.toLowerCase().includes(searchQuery.toLowerCase());
    const matchesFav = filterFavorite ? t.isFavorite : true;
    return matchesSearch && matchesFav;
  });

  // Tracks inside selected playlist
  const playlistTracks = selectedPlaylist
    ? tracks.filter((t) => (selectedPlaylist.trackIds || []).includes(t.id))
    : [];

  // Handle local file upload
  const handleFileChange = async (e) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    try {
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith('audio/') && !file.name.endsWith('.mp3')) {
          continue;
        }

        const cleanName = file.name.replace(/\.[^/.]+$/, '');
        const parts = cleanName.split('-');
        const artist = parts.length > 1 ? parts[0].trim() : 'Local Audio';
        const title = parts.length > 1 ? parts.slice(1).join('-').trim() : cleanName;

        const newTrack = {
          id: 'local_' + Date.now() + '_' + Math.random().toString(36).substring(2, 6),
          title: title,
          artist: artist,
          genre: 'Local Track',
          cozyColor: '#a16e50',
          cozyVibe: 'imported from your collection',
          duration: 0
        };

        const saved = await saveTrackOffline(newTrack, file);
        if (onTrackImported) onTrackImported(saved);
      }
    } catch (err) {
      console.error('Failed to import file:', err);
      setErrorMsg('Failed to save audio file to offline storage.');
    }

    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  // Handle downloading from direct URL
  const handleDownloadCustomUrl = async (e) => {
    e.preventDefault();
    if (!customUrl) return;

    try {
      setIsDownloadingUrl(true);
      setErrorMsg('');
      const res = await fetch(customUrl);
      if (!res.ok) throw new Error('Could not fetch URL: ' + res.statusText);
      const blob = await res.blob();

      const urlParts = customUrl.split('/');
      const rawName = urlParts[urlParts.length - 1].split('?')[0] || 'Custom Track';
      const cleanTitle = decodeURIComponent(rawName).replace(/\.[^/.]+$/, '');

      const trackMeta = {
        id: 'url_' + Date.now(),
        title: cleanTitle,
        artist: 'Web Audio',
        genre: 'Web Stream',
        cozyColor: '#7a6e60',
        cozyVibe: 'saved from the web'
      };

      const saved = await saveTrackOffline(trackMeta, blob);
      if (onTrackImported) onTrackImported(saved);
      setCustomUrl('');
      setShowUrlInput(false);
    } catch (err) {
      console.error(err);
      setErrorMsg('Could not download audio from that link. Check URL permissions (CORS).');
    } finally {
      setIsDownloadingUrl(false);
    }
  };

  const totalSizeMB = tracks.reduce((acc, t) => acc + (t.fileSize || 0), 0) / (1024 * 1024);

  return (
    <div className="offline-library-panel">
      {/* Storage Header */}
      <div className="library-header-card">
        <div className="header-icon-box">
          <HardDrive size={22} className="text-amber" />
        </div>
        <div className="header-text">
          <h3>Offline Pocket Storage</h3>
          <p>
            {tracks.length} {tracks.length === 1 ? 'song' : 'songs'} kept in app ({totalSizeMB.toFixed(1)} MB) • 100% offline ready
          </p>
        </div>
      </div>

      {/* Action Bar: YouTube to MP3, Upload, Add URL, Discover */}
      <div className="library-actions-row">
        <input
          type="file"
          accept="audio/*,.mp3,.wav,.ogg,.m4a"
          multiple
          ref={fileInputRef}
          style={{ display: 'none' }}
          onChange={handleFileChange}
        />
        <button 
          className="action-pill-btn yt-action-btn"
          onClick={onOpenYouTubeConverter}
          title="Convert YouTube video to offline tape"
        >
          <YoutubeIcon size={15} className="text-red-icon" /> YouTube to MP3
        </button>

        <button 
          className="action-pill-btn primary"
          onClick={() => fileInputRef.current && fileInputRef.current.click()}
        >
          <Upload size={15} /> Import Audio
        </button>

        <button 
          className="action-pill-btn secondary"
          onClick={() => setShowUrlInput(!showUrlInput)}
        >
          <Plus size={15} /> Add URL
        </button>

        <button 
          className="action-pill-btn highlight"
          onClick={onOpenDiscover}
        >
          <Sparkles size={15} /> Get Chill Beats
        </button>
      </div>

      {/* URL download input tray */}
      {showUrlInput && (
        <form className="url-download-form" onSubmit={handleDownloadCustomUrl}>
          <input
            type="url"
            placeholder="Paste direct audio MP3 link..."
            value={customUrl}
            onChange={(e) => setCustomUrl(e.target.value)}
            className="cozy-input"
            required
          />
          <button type="submit" className="cozy-submit-btn" disabled={isDownloadingUrl}>
            {isDownloadingUrl ? 'Saving...' : 'Save'}
          </button>
        </form>
      )}

      {errorMsg && (
        <div className="error-alert">
          <AlertCircle size={15} /> {errorMsg}
        </div>
      )}

      {/* Library Sub-Tabs: [ All Songs (X) ] | [ 📼 Mixtapes (Y) ] */}
      <div className="library-subtabs-nav">
        <button
          className={`subtab-btn ${activeSubTab === 'tracks' ? 'active' : ''}`}
          onClick={() => {
            setActiveSubTab('tracks');
            setSelectedPlaylistId(null);
          }}
        >
          <Music size={14} />
          <span>All Songs ({tracks.length})</span>
        </button>
        <button
          className={`subtab-btn ${activeSubTab === 'mixtapes' ? 'active' : ''}`}
          onClick={() => setActiveSubTab('mixtapes')}
        >
          <Radio size={14} />
          <span>Mixtapes ({playlists.length})</span>
        </button>
      </div>

      {/* -------------------------------------------------------------
          SUB-TAB 1: ALL TRACKS VIEW
          ------------------------------------------------------------- */}
      {activeSubTab === 'tracks' && (
        <>
          {/* Search & Favorites Toggle */}
          <div className="search-filter-bar">
            <div className="search-box">
              <Search size={16} className="search-icon" />
              <input
                type="text"
                placeholder="Search saved songs..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="search-input"
              />
            </div>
            <button
              className={`filter-fav-pill ${filterFavorite ? 'active' : ''}`}
              onClick={() => setFilterFavorite(!filterFavorite)}
            >
              <Heart size={14} fill={filterFavorite ? '#b85d43' : 'none'} />
              Favs
            </button>
          </div>

          {/* Track List */}
          <div className="tracks-scroll-list">
            {filteredTracks.length === 0 ? (
              <div className="empty-library-view">
                <div className="empty-art">📻</div>
                <h4>Your tape box is empty</h4>
                <p>Paste any YouTube URL, download chill beats, or import your MP3s to listen anywhere without internet.</p>
                <div className="empty-cta-group">
                  <button className="empty-cta-btn yt-cta" onClick={onOpenYouTubeConverter}>
                    <YoutubeIcon size={15} /> Convert YouTube to Tape
                  </button>
                  <button className="empty-cta-btn secondary" onClick={onOpenDiscover}>
                    Browse Relaxing Music
                  </button>
                </div>
              </div>
            ) : (
              filteredTracks.map((track) => {
                const isCurrent = currentTrack && currentTrack.id === track.id;
                const sizeFormatted = track.fileSize 
                  ? (track.fileSize / (1024 * 1024)).toFixed(1) + ' MB'
                  : 'Cached';

                return (
                  <div 
                    key={track.id} 
                    className={`track-item-card ${isCurrent ? 'is-active-track' : ''}`}
                  >
                    <button 
                      className="play-track-trigger"
                      onClick={() => onPlayTrack(track)}
                    >
                      <div className="track-thumb">
                        {track.coverArt ? (
                          <img src={track.coverArt} alt={track.title} />
                        ) : (
                          <div className="thumb-placeholder" style={{ background: track.cozyColor || '#8a6552' }}>
                            <FileAudio size={20} color="#fbf7f2" />
                          </div>
                        )}
                        {isCurrent && isPlaying && (
                          <div className="thumb-equalizer-overlay">
                            <span className="eq-bar bar-1"></span>
                            <span className="eq-bar bar-2"></span>
                            <span className="eq-bar bar-3"></span>
                          </div>
                        )}
                      </div>

                      <div className="track-info">
                        <div className="track-title-row">
                          <span className="track-name">{track.title}</span>
                        </div>
                        <div className="track-sub-row">
                          <span className="track-artist">{track.artist}</span>
                          <span className="dot-divider">•</span>
                          <span className="track-size">{sizeFormatted}</span>
                        </div>
                      </div>
                    </button>

                    <div className="track-actions">
                      {/* Add to Playlist button */}
                      <button 
                        className="track-fav-icon"
                        onClick={() => setTrackToAddToPlaylist(track)}
                        title="Add to Mixtape / Playlist"
                      >
                        <ListPlus size={16} />
                      </button>

                      {/* Favorite button */}
                      <button 
                        className={`track-fav-icon ${track.isFavorite ? 'fav' : ''}`}
                        onClick={() => onToggleFavorite(track.id)}
                        title="Favorite"
                      >
                        <Heart size={16} fill={track.isFavorite ? '#b85d43' : 'none'} stroke={track.isFavorite ? '#b85d43' : '#8e796c'} />
                      </button>

                      {/* Delete button */}
                      <button 
                        className="track-delete-icon"
                        onClick={() => onDeleteTrack(track.id)}
                        title="Remove from offline storage"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </>
      )}

      {/* -------------------------------------------------------------
          SUB-TAB 2: MIXTAPES / PLAYLISTS VIEW
          ------------------------------------------------------------- */}
      {activeSubTab === 'mixtapes' && (
        <div className="mixtapes-view-container">
          {!selectedPlaylist ? (
            /* ALL MIXTAPES LIST */
            <>
              <div className="mixtapes-header-row">
                <span className="mixtapes-count-tag">{playlists.length} Custom Tapes</span>
                <button 
                  className="create-mixtape-btn"
                  onClick={onOpenCreatePlaylist}
                >
                  <Plus size={15} /> New Mixtape
                </button>
              </div>

              {playlists.length === 0 ? (
                <div className="empty-mixtapes-box">
                  <div className="empty-art">📼</div>
                  <h4>No Custom Mixtapes Yet</h4>
                  <p>Group your downloaded tracks into custom tapes for study, late nights, or relaxing.</p>
                  <button className="empty-cta-btn" onClick={onOpenCreatePlaylist}>
                    + Create Your First Mixtape
                  </button>
                </div>
              ) : (
                <div className="mixtapes-grid">
                  {playlists.map((pl) => {
                    const count = (pl.trackIds || []).length;
                    return (
                      <div 
                        key={pl.id} 
                        className="mixtape-card"
                        style={{ '--tape-color': pl.color || '#b85d43' }}
                      >
                        {/* Cassette Header Bar */}
                        <div 
                          className="mixtape-tape-spine" 
                          style={{ background: pl.color || '#b85d43' }}
                          onClick={() => setSelectedPlaylistId(pl.id)}
                        >
                          <span className="spine-badge">TYPE II</span>
                          <span className="spine-reels">○○ ─── ○○</span>
                          <span className="spine-track-count">{count} {count === 1 ? 'song' : 'songs'}</span>
                        </div>

                        {/* Card Body */}
                        <div className="mixtape-card-body" onClick={() => setSelectedPlaylistId(pl.id)}>
                          <div className="mixtape-title">{pl.name}</div>
                          {pl.description && (
                            <div className="mixtape-desc">"{pl.description}"</div>
                          )}
                        </div>

                        {/* Card Actions */}
                        <div className="mixtape-actions-footer">
                          <button 
                            className="mixtape-play-btn"
                            onClick={() => onPlayPlaylist(pl)}
                            disabled={count === 0}
                            title="Play this tape"
                          >
                            <Play size={14} fill="#fff" /> Play Tape
                          </button>

                          <div className="mixtape-edit-actions">
                            <button 
                              className="mixtape-icon-subbtn"
                              onClick={() => onOpenEditPlaylist(pl)}
                              title="Edit mixtape"
                            >
                              <Edit3 size={14} />
                            </button>
                            <button 
                              className="mixtape-icon-subbtn delete"
                              onClick={() => onDeletePlaylist(pl.id)}
                              title="Delete mixtape"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </>
          ) : (
            /* SINGLE MIXTAPE DETAIL VIEW */
            <div className="mixtape-detail-view">
              <div className="detail-header-bar">
                <button 
                  className="detail-back-btn"
                  onClick={() => setSelectedPlaylistId(null)}
                >
                  <ArrowLeft size={16} /> All Mixtapes
                </button>
                <div className="detail-header-actions">
                  <button 
                    className="detail-edit-btn"
                    onClick={() => onOpenEditPlaylist(selectedPlaylist)}
                  >
                    Edit Tape
                  </button>
                </div>
              </div>

              {/* Mixtape Banner */}
              <div 
                className="mixtape-banner-card"
                style={{ '--tape-banner-color': selectedPlaylist.color || '#b85d43' }}
              >
                <div className="banner-badge">📼 MIXTAPE</div>
                <h3>{selectedPlaylist.name}</h3>
                {selectedPlaylist.description && (
                  <p className="banner-vibe">"{selectedPlaylist.description}"</p>
                )}
                <div className="banner-meta">
                  <span>{playlistTracks.length} {playlistTracks.length === 1 ? 'track' : 'tracks'}</span>
                </div>

                {playlistTracks.length > 0 && (
                  <button 
                    className="banner-play-btn"
                    onClick={() => onPlayPlaylist(selectedPlaylist)}
                  >
                    <Play size={16} fill="#fff" /> Play Full Tape
                  </button>
                )}
              </div>

              {/* Songs in this mixtape */}
              <div className="mixtape-tracks-list">
                {playlistTracks.length === 0 ? (
                  <div className="empty-mixtape-songs-box">
                    <p>No songs added to this tape yet.</p>
                    <button 
                      className="add-songs-switch-btn"
                      onClick={() => setActiveSubTab('tracks')}
                    >
                      Go to All Songs & Tap <ListPlus size={13} className="inline ml-1" />
                    </button>
                  </div>
                ) : (
                  playlistTracks.map((track) => (
                    <div key={track.id} className="track-item-card">
                      <button 
                        className="play-track-trigger"
                        onClick={() => onPlayTrack(track)}
                      >
                        <div className="track-thumb">
                          {track.coverArt ? (
                            <img src={track.coverArt} alt={track.title} />
                          ) : (
                            <div className="thumb-placeholder" style={{ background: track.cozyColor || '#8a6552' }}>
                              <FileAudio size={20} color="#fbf7f2" />
                            </div>
                          )}
                        </div>
                        <div className="track-info">
                          <span className="track-name">{track.title}</span>
                          <span className="track-artist">{track.artist}</span>
                        </div>
                      </button>

                      <button 
                        className="track-delete-icon"
                        onClick={() => onRemoveTrackFromPlaylist(selectedPlaylist.id, track.id)}
                        title="Remove from this mixtape"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  ))
                )}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Add To Playlist Modal */}
      <AddToPlaylistModal
        isOpen={!!trackToAddToPlaylist}
        onClose={() => setTrackToAddToPlaylist(null)}
        track={trackToAddToPlaylist}
        playlists={playlists}
        onToggleTrackInPlaylist={onToggleTrackInPlaylist}
        onCreateNewPlaylist={onOpenCreatePlaylist}
      />
    </div>
  );
}
