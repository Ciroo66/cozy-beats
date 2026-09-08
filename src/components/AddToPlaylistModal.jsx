import React from 'react';
import { X, Check, Plus, Radio, Disc } from 'lucide-react';

export default function AddToPlaylistModal({
  isOpen,
  onClose,
  track,
  playlists = [],
  onToggleTrackInPlaylist,
  onCreateNewPlaylist
}) {
  if (!isOpen || !track) return null;

  return (
    <div className="cozy-modal-backdrop" onClick={onClose}>
      <div className="cozy-modal-card add-to-playlist-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-box">
            <span className="modal-badge">📼 ADD TO MIXTAPE</span>
            <h3>Add Song to Playlist</h3>
            <p className="modal-sub">"{track.title}" by {track.artist}</p>
          </div>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="playlist-picker-list">
          {playlists.length === 0 ? (
            <div className="empty-picker-notice">
              <p>You haven't made any mixtapes yet.</p>
              <button 
                className="create-first-pl-btn"
                onClick={() => {
                  onClose();
                  onCreateNewPlaylist();
                }}
              >
                <Plus size={15} /> Create Your First Mixtape
              </button>
            </div>
          ) : (
            <>
              {playlists.map((pl) => {
                const isInPlaylist = (pl.trackIds || []).includes(track.id);
                return (
                  <button
                    key={pl.id}
                    className={`picker-playlist-item ${isInPlaylist ? 'is-included' : ''}`}
                    onClick={() => onToggleTrackInPlaylist(pl.id, track.id)}
                  >
                    <div 
                      className="picker-tape-icon"
                      style={{ background: pl.color || '#b85d43' }}
                    >
                      <Radio size={14} color="#fff" />
                    </div>
                    <div className="picker-pl-info">
                      <div className="picker-pl-name">{pl.name}</div>
                      <div className="picker-pl-count">
                        {(pl.trackIds || []).length} {((pl.trackIds || []).length === 1) ? 'song' : 'songs'}
                      </div>
                    </div>
                    <div className={`picker-check-circle ${isInPlaylist ? 'active' : ''}`}>
                      {isInPlaylist && <Check size={14} color="#fff" />}
                    </div>
                  </button>
                );
              })}

              <button 
                className="picker-add-new-btn"
                onClick={() => {
                  onClose();
                  onCreateNewPlaylist();
                }}
              >
                <Plus size={15} /> Create Another Mixtape
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
