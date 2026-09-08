import React, { useState } from 'react';
import { CloudRain, Disc, Flame, Wind, Volume2, X } from 'lucide-react';
import { ambientEngine } from '../services/ambientAudio';

export default function AmbientMixer({ isOpen, onClose }) {
  const [ambientStates, setAmbientStates] = useState({
    rain: { active: false, vol: 0.4 },
    vinyl: { active: false, vol: 0.35 },
    fireplace: { active: false, vol: 0.3 },
    breeze: { active: false, vol: 0.25 }
  });

  if (!isOpen) return null;

  const handleToggle = (key) => {
    const active = ambientEngine.toggleSound(key);
    setAmbientStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], active }
    }));
  };

  const handleVol = (key, val) => {
    ambientEngine.setVolume(key, val);
    setAmbientStates((prev) => ({
      ...prev,
      [key]: { ...prev[key], vol: val }
    }));
  };

  const soundItems = [
    { key: 'rain', name: 'Rain on Glass', icon: CloudRain, color: '#5f7988', desc: 'Mellow raindrops against window' },
    { key: 'vinyl', name: 'Vinyl Dust & Needle', icon: Disc, color: '#886d5f', desc: 'Analog static & nostalgic clicks' },
    { key: 'fireplace', name: 'Campfire Embers', icon: Flame, color: '#a05c3c', desc: 'Warm crackling fireplace wood' },
    { key: 'breeze', name: 'Pine Forest Breeze', icon: Wind, color: '#688267', desc: 'Gentle night wind through trees' }
  ];

  return (
    <div className="cozy-modal-backdrop" onClick={onClose}>
      <div className="cozy-modal-card ambient-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-box">
            <span className="modal-badge">☕ COZY SOUNDSCAPE MIXER</span>
            <h3>Background Ambience</h3>
            <p className="modal-sub">Layer calming sounds underneath your music for deep relaxation.</p>
          </div>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        <div className="ambient-grid">
          {soundItems.map(({ key, name, icon: Icon, color, desc }) => {
            const current = ambientStates[key];
            return (
              <div 
                key={key} 
                className={`ambient-card ${current.active ? 'is-on' : ''}`}
                style={{ '--accent-color': color }}
              >
                <div className="ambient-card-top" onClick={() => handleToggle(key)}>
                  <div className="ambient-icon-wrap" style={{ background: current.active ? color : '#ded3c5' }}>
                    <Icon size={20} color={current.active ? '#fff' : '#5c483a'} />
                  </div>
                  <div className="ambient-info">
                    <div className="ambient-name">{name}</div>
                    <div className="ambient-desc">{desc}</div>
                  </div>
                  <button className={`toggle-pill ${current.active ? 'on' : 'off'}`}>
                    {current.active ? 'ON' : 'OFF'}
                  </button>
                </div>

                {current.active && (
                  <div className="ambient-volume-slider">
                    <Volume2 size={14} color="#7d6a5c" />
                    <input
                      type="range"
                      min="0.05"
                      max="1"
                      step="0.05"
                      value={current.vol}
                      onChange={(e) => handleVol(key, parseFloat(e.target.value))}
                      className="cozy-slider"
                    />
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
