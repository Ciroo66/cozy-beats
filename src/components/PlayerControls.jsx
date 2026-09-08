import React from 'react';
import { 
  Play, 
  Pause, 
  SkipBack, 
  SkipForward, 
  Shuffle, 
  Repeat, 
  Repeat1, 
  Volume2, 
  VolumeX, 
  Heart 
} from 'lucide-react';

function formatTime(seconds) {
  if (isNaN(seconds) || seconds < 0) return '0:00';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

export default function PlayerControls({
  isPlaying,
  currentTime,
  duration,
  volume,
  isMuted,
  isShuffle,
  repeatMode, // 'off' | 'all' | 'one'
  isFavorite,
  onPlayPause,
  onNext,
  onPrev,
  onSeek,
  onVolumeChange,
  onToggleMute,
  onToggleShuffle,
  onToggleRepeat,
  onToggleFavorite
}) {
  const handleSeekChange = (e) => {
    const val = parseFloat(e.target.value);
    onSeek(val);
  };

  return (
    <div className="player-controls-deck">
      {/* Time scrubber */}
      <div className="scrubber-section">
        <div className="time-display current-time">{formatTime(currentTime)}</div>
        <div className="slider-wrapper">
          <input
            type="range"
            min="0"
            max={duration || 100}
            step="0.5"
            value={currentTime}
            onChange={handleSeekChange}
            className="cozy-slider seek-slider"
            style={{
              background: `linear-gradient(to right, #b85d43 ${(currentTime / (duration || 1)) * 100}%, #e2d2c1 ${(currentTime / (duration || 1)) * 100}%)`
            }}
          />
        </div>
        <div className="time-display total-time">{formatTime(duration)}</div>
      </div>

      {/* Main Tactile Buttons */}
      <div className="controls-button-row">
        {/* Shuffle */}
        <button
          className={`aux-btn ${isShuffle ? 'active' : ''}`}
          onClick={onToggleShuffle}
          title={isShuffle ? 'Shuffle On' : 'Shuffle Off'}
        >
          <Shuffle size={18} />
        </button>

        {/* Previous */}
        <button
          className="transport-btn prev-btn"
          onClick={onPrev}
          title="Previous Track"
        >
          <SkipBack size={22} />
        </button>

        {/* Big Play / Pause Tactile Button */}
        <button
          className={`master-play-btn ${isPlaying ? 'playing' : ''}`}
          onClick={onPlayPause}
          title={isPlaying ? 'Pause' : 'Play'}
        >
          {isPlaying ? (
            <Pause size={28} className="icon-pause" />
          ) : (
            <Play size={28} className="icon-play" />
          )}
        </button>

        {/* Next */}
        <button
          className="transport-btn next-btn"
          onClick={onNext}
          title="Next Track"
        >
          <SkipForward size={22} />
        </button>

        {/* Repeat */}
        <button
          className={`aux-btn ${repeatMode !== 'off' ? 'active' : ''}`}
          onClick={onToggleRepeat}
          title={`Repeat: ${repeatMode}`}
        >
          {repeatMode === 'one' ? <Repeat1 size={18} /> : <Repeat size={18} />}
        </button>
      </div>

      {/* Auxiliary bar: Volume & Favorite */}
      <div className="controls-sub-bar">
        <button 
          className={`fav-btn ${isFavorite ? 'is-fav' : ''}`}
          onClick={onToggleFavorite}
          title="Favorite Track"
        >
          <Heart size={18} fill={isFavorite ? '#b85d43' : 'none'} stroke={isFavorite ? '#b85d43' : '#6d5a4d'} />
          <span className="fav-label">{isFavorite ? 'Saved to Favorites' : 'Favorite'}</span>
        </button>

        <div className="volume-group">
          <button className="vol-icon-btn" onClick={onToggleMute}>
            {isMuted || volume === 0 ? <VolumeX size={17} /> : <Volume2 size={17} />}
          </button>
          <input
            type="range"
            min="0"
            max="1"
            step="0.02"
            value={isMuted ? 0 : volume}
            onChange={(e) => onVolumeChange(parseFloat(e.target.value))}
            className="cozy-slider vol-slider"
            style={{
              background: `linear-gradient(to right, #795548 ${(isMuted ? 0 : volume) * 100}%, #e2d2c1 ${(isMuted ? 0 : volume) * 100}%)`
            }}
          />
        </div>
      </div>
    </div>
  );
}
