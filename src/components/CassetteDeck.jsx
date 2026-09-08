import React from 'react';
import { Disc, Sparkles } from 'lucide-react';

export default function CassetteDeck({
  currentTrack,
  isPlaying,
  progress = 0, // 0 to 1
  viewMode = 'cassette', // 'cassette' | 'vinyl'
  onToggleViewMode
}) {
  const title = currentTrack ? currentTrack.title : 'No Tape Inserted';
  const artist = currentTrack ? currentTrack.artist : 'Select a track to relax';
  const vibe = currentTrack?.cozyVibe || 'warm tea & quiet night';
  const coverArt = currentTrack?.coverArt;

  // Calculate reel spool thickness based on progress
  const leftSpoolRadius = 26 - (progress * 12); // shrinks as tape plays
  const rightSpoolRadius = 14 + (progress * 12); // grows as tape plays

  return (
    <div className="cassette-deck-container">
      {/* Mode switch pill */}
      <div className="deck-mode-toggle">
        <button
          className={`mode-btn ${viewMode === 'cassette' ? 'active' : ''}`}
          onClick={() => onToggleViewMode('cassette')}
          title="Switch to Cassette Tape"
        >
          📼 Cassette
        </button>
        <button
          className={`mode-btn ${viewMode === 'vinyl' ? 'active' : ''}`}
          onClick={() => onToggleViewMode('vinyl')}
          title="Switch to Vinyl Record"
        >
          <Disc size={14} className="inline mr-1" /> Vinyl
        </button>
      </div>

      {viewMode === 'cassette' ? (
        /* VINTAGE RETRO CASSETTE TAPE */
        <div className={`cassette-card ${isPlaying ? 'is-playing' : ''}`}>
          {/* Cassette Outer Shell */}
          <div className="cassette-shell">
            {/* Top screws */}
            <div className="screw screw-tl"></div>
            <div className="screw screw-tr"></div>
            <div className="screw screw-bl"></div>
            <div className="screw screw-br"></div>

            {/* Vintage Label */}
            <div className="cassette-label">
              <div className="label-header">
                <span className="badge-side">SIDE A</span>
                <span className="label-brand">COZY CHILL • TAPE NO. 9</span>
                <span className="badge-type">TYPE I / LO-FI</span>
              </div>

              {/* Handwritten Track Title */}
              <div className="label-title-area">
                <div className="handwritten-title">{title}</div>
                <div className="handwritten-artist">{artist}</div>
              </div>

              {/* Spool / Tape Window */}
              <div className="tape-window-frame">
                <div className="tape-window">
                  {/* Left Reel Spool */}
                  <div className="reel-assembly">
                    <div
                      className="tape-spool left-spool"
                      style={{ width: `${leftSpoolRadius * 2}px`, height: `${leftSpoolRadius * 2}px` }}
                    />
                    <div className={`reel-cog ${isPlaying ? 'spin-clockwise' : ''}`}>
                      <div className="cog-teeth"></div>
                      <div className="cog-center"></div>
                    </div>
                  </div>

                  {/* Tape bridge connecting spools */}
                  <div className="tape-ribbon-bridge">
                    <div className="progress-indicator-line" style={{ width: `${progress * 100}%` }}></div>
                  </div>

                  {/* Right Reel Spool */}
                  <div className="reel-assembly">
                    <div
                      className="tape-spool right-spool"
                      style={{ width: `${rightSpoolRadius * 2}px`, height: `${rightSpoolRadius * 2}px` }}
                    />
                    <div className={`reel-cog ${isPlaying ? 'spin-clockwise' : ''}`}>
                      <div className="cog-teeth"></div>
                      <div className="cog-center"></div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Tape bottom details */}
              <div className="label-footer">
                <span className="vibe-text">🍃 {vibe}</span>
                <span className="eq-mark">NR [ON]</span>
              </div>
            </div>

            {/* Lower Cassette Wedge */}
            <div className="cassette-bottom-wedge">
              <div className="tape-head-hole"></div>
              <div className="roller-hole left"></div>
              <div className="roller-hole right"></div>
            </div>
          </div>
        </div>
      ) : (
        /* WARM VINTAGE VINYL PLAYER */
        <div className={`vinyl-player-card ${isPlaying ? 'is-playing' : ''}`}>
          <div className="turntable-wood-plinth">
            <div className={`vinyl-record ${isPlaying ? 'spin-vinyl' : ''}`}>
              {/* Vinyl Grooves */}
              <div className="groove groove-1"></div>
              <div className="groove groove-2"></div>
              <div className="groove groove-3"></div>
              <div className="groove groove-4"></div>

              {/* Center Vinyl Label */}
              <div className="vinyl-center-label">
                {coverArt ? (
                  <img src={coverArt} alt={title} className="vinyl-cover-img" />
                ) : (
                  <div className="vinyl-label-fallback">
                    <span className="vinyl-brand">COZY</span>
                    <span className="vinyl-rpm">33 RPM</span>
                  </div>
                )}
                <div className="spindle-hole"></div>
              </div>
            </div>

            {/* Tonearm */}
            <div className={`tonearm-assembly ${isPlaying ? 'arm-on-record' : 'arm-rest'}`}>
              <div className="tonearm-base"></div>
              <div className="tonearm-arm"></div>
              <div className="tonearm-headshell"></div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
