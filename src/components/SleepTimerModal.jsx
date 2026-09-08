import React from 'react';
import { Moon, Clock, X, Check } from 'lucide-react';

export default function SleepTimerModal({
  isOpen,
  onClose,
  activeTimerMinutes,
  remainingSeconds,
  onSetTimer,
  onCancelTimer
}) {
  if (!isOpen) return null;

  const options = [
    { label: '15 Minutes', mins: 15 },
    { label: '30 Minutes', mins: 30 },
    { label: '45 Minutes', mins: 45 },
    { label: '60 Minutes', mins: 60 },
    { label: 'End of Current Track', mins: 'track' }
  ];

  const formatRemaining = (totalSec) => {
    const m = Math.floor(totalSec / 60);
    const s = totalSec % 60;
    return `${m}m ${s < 10 ? '0' : ''}${s}s remaining`;
  };

  return (
    <div className="cozy-modal-backdrop" onClick={onClose}>
      <div className="cozy-modal-card timer-modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title-box">
            <span className="modal-badge">🌙 NIGHT REST</span>
            <h3>Bedtime Sleep Timer</h3>
            <p className="modal-sub">Music will gently stop when the timer expires so you can sleep peacefully.</p>
          </div>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {remainingSeconds > 0 && (
          <div className="active-timer-banner">
            <Clock size={16} className="text-amber" />
            <span>Active: {formatRemaining(remainingSeconds)}</span>
            <button className="cancel-timer-link" onClick={onCancelTimer}>
              Cancel Timer
            </button>
          </div>
        )}

        <div className="timer-options-list">
          {options.map((opt) => {
            const isSelected = activeTimerMinutes === opt.mins;
            return (
              <button
                key={opt.label}
                className={`timer-option-btn ${isSelected ? 'selected' : ''}`}
                onClick={() => {
                  onSetTimer(opt.mins);
                  onClose();
                }}
              >
                <span>{opt.label}</span>
                {isSelected && <Check size={18} className="check-icon" />}
              </button>
            );
          })}
        </div>
      </div>
    </div>
  );
}
