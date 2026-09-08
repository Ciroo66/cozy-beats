import React, { useState, useEffect } from 'react';
import { X, Check, Disc, Music, Plus } from 'lucide-react';

const TAPE_COLORS = [
  { label: 'Terracotta', color: '#b85d43' },
  { label: 'Sage Olive', color: '#6c7d61' },
  { label: 'Walnut Mocha', color: '#4d3629' },
  { label: 'Warm Honey', color: '#d8973c' },
  { label: 'Dusty Rose', color: '#a26769' },
  { label: 'Rainy Slate', color: '#5e747f' }
];

export default function PlaylistModal({
  isOpen,
  onClose,
  allTracks = [],
  playlistToEdit = null,
  onSavePlaylist
}) {
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [selectedColor, setSelectedColor] = useState('#b85d43');
  const [selectedTrackIds, setSelectedTrackIds] = useState([]);

  useEffect(() => {
    if (isOpen) {
      if (playlistToEdit) {
        setName(playlistToEdit.name || '');
        setDescription(playlistToEdit.description || '');
        setSelectedColor(playlistToEdit.color || '#b85d43');
        setSelectedTrackIds(playlistToEdit.trackIds || []);
      } else {
        setName('');
        setDescription('');
        setSelectedColor('#b85d43');
        setSelectedTrackIds([]);
      }
    }
  }, [isOpen, playlistToEdit]);

  if (!isOpen) return null;

  const toggleTrack = (trackId) => {
    setSelectedTrackIds((prev) => 
      prev.includes(trackId)
        ? prev.filter((id) => id !== trackId)
        : [...prev, trackId]
    );
  };

  const handleSave = (e) => {
    e.preventDefault();
    if (!name.trim()) return;

    onSavePlaylist({
      id: playlistToEdit?.id,
      name: name.trim(),
      description: description.trim(),
      color: selectedColor,
      trackIds: selectedTrackIds
    });
    onClose();
  };

  return (
    <div className="cozy-modal-backdrop" onClick={onClose}>
      <div className="cozy-modal-card playlist-modal" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-box">
            <span className="modal-badge">📼 CUSTOM MIXTAPE</span>
            <h3>{playlistToEdit ? 'Edit Mixtape' : 'Create New Mixtape'}</h3>
            <p className="modal-sub">Group your favorite downloaded beats into a custom tape.</p>
          </div>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <form onSubmit={handleSave} className="playlist-form">
          {/* Name */}
          <div className="form-group">
            <label className="cozy-label">Mixtape Title</label>
            <input
              type="text"
              placeholder="e.g. Rainy Study Night, Late Coffee..."
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="cozy-input"
              required
              autoFocus
            />
          </div>

          {/* Description */}
          <div className="form-group">
            <label className="cozy-label">Cozy Note / Vibe (optional)</label>
            <input
              type="text"
              placeholder="e.g. warm blanket & hot cocoa"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="cozy-input"
            />
          </div>

          {/* Tape Color Selector */}
          <div className="form-group">
            <label className="cozy-label">Cassette Shell Color</label>
            <div className="tape-color-options">
              {TAPE_COLORS.map((c) => (
                <button
                  key={c.color}
                  type="button"
                  className={`color-swatch-btn ${selectedColor === c.color ? 'active' : ''}`}
                  style={{ background: c.color }}
                  onClick={() => setSelectedColor(c.color)}
                  title={c.label}
                >
                  {selectedColor === c.color && <Check size={14} color="#fff" />}
                </button>
              ))}
            </div>
          </div>

          {/* Select Tracks Checklist */}
          <div className="form-group track-selector-group">
            <label className="cozy-label">
              Select Songs ({selectedTrackIds.length} added)
            </label>
            <div className="track-checklist-scroll">
              {allTracks.length === 0 ? (
                <div className="no-tracks-prompt">No downloaded tracks found yet.</div>
              ) : (
                allTracks.map((track) => {
                  const isChecked = selectedTrackIds.includes(track.id);
                  return (
                    <div 
                      key={track.id} 
                      className={`checklist-track-item ${isChecked ? 'checked' : ''}`}
                      onClick={() => toggleTrack(track.id)}
                    >
                      <div className={`track-checkbox ${isChecked ? 'checked' : ''}`}>
                        {isChecked && <Check size={12} color="#fff" />}
                      </div>
                      <div className="checklist-track-info">
                        <div className="checklist-title">{track.title}</div>
                        <div className="checklist-artist">{track.artist}</div>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </div>

          <button type="submit" className="save-playlist-submit-btn" disabled={!name.trim()}>
            {playlistToEdit ? 'Update Mixtape' : 'Create Mixtape'}
          </button>
        </form>
      </div>
    </div>
  );
}
