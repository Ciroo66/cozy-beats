import React, { useState } from 'react';
import { Download, Check, X, Sparkles, Music, Play, Pause, Loader2 } from 'lucide-react';
import { SAMPLE_TRACKS, createOfflineSoothingTrackBlob } from '../services/sampleTracks';
import { downloadAndSaveTrack, saveTrackOffline } from '../services/storage';

export default function DiscoverModal({
  isOpen,
  onClose,
  savedTrackIds = new Set(),
  onTrackSaved,
  onPreviewTrack,
  previewingTrackId,
  isPreviewPlaying
}) {
  const [downloadingIds, setDownloadingIds] = useState({}); // { id: progressPercent }
  const [isGeneratingProcedural, setIsGeneratingProcedural] = useState(false);

  if (!isOpen) return null;

  const handleDownload = async (track) => {
    if (savedTrackIds.has(track.id) || downloadingIds[track.id] !== undefined) return;

    try {
      setDownloadingIds((prev) => ({ ...prev, [track.id]: 0 }));
      
      const saved = await downloadAndSaveTrack(track, (progress) => {
        setDownloadingIds((prev) => ({ ...prev, [track.id]: progress }));
      });

      if (onTrackSaved) onTrackSaved(saved);
    } catch (err) {
      console.error('Download error:', err);
      alert('Could not download this track right now. Check internet connection.');
    } finally {
      setDownloadingIds((prev) => {
        const next = { ...prev };
        delete next[track.id];
        return next;
      });
    }
  };

  const handleDownloadOfflineGenerated = async () => {
    try {
      setIsGeneratingProcedural(true);
      const title = 'Midnight Tea Bells (Offline)';
      const blob = createOfflineSoothingTrackBlob(title);
      
      const trackMeta = {
        id: 'procedural_' + Date.now(),
        title: title,
        artist: 'Cozy Synthesis Engine',
        duration: 16,
        genre: 'Procedural Ambient',
        cozyColor: '#5a6872',
        cozyVibe: 'procedurally synthesized chill chimes'
      };

      const saved = await saveTrackOffline(trackMeta, blob);
      if (onTrackSaved) onTrackSaved(saved);
    } catch (err) {
      console.error(err);
    } finally {
      setIsGeneratingProcedural(false);
    }
  };

  return (
    <div className="cozy-modal-backdrop" onClick={onClose}>
      <div className="cozy-modal-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="modal-header">
          <div className="modal-title-box">
            <span className="modal-badge">🍃 CHILL CASSETTE CATALOG</span>
            <h3>Download Relaxing Beats</h3>
            <p className="modal-sub">1-Click download directly to your phone. Keeps forever offline.</p>
          </div>
          <button className="close-modal-btn" onClick={onClose}>
            <X size={20} />
          </button>
        </div>

        {/* Catalog List */}
        <div className="catalog-scroll-list">
          {SAMPLE_TRACKS.map((track) => {
            const isSaved = savedTrackIds.has(track.id);
            const downloadProgress = downloadingIds[track.id];
            const isDownloading = downloadProgress !== undefined;
            const isPreviewing = previewingTrackId === track.id && isPreviewPlaying;

            return (
              <div key={track.id} className="catalog-item">
                <div className="catalog-item-cover">
                  <img src={track.coverArt} alt={track.title} />
                  <button 
                    className="preview-play-btn"
                    onClick={() => onPreviewTrack(track)}
                    title={isPreviewing ? 'Pause preview' : 'Listen preview'}
                  >
                    {isPreviewing ? <Pause size={14} /> : <Play size={14} />}
                  </button>
                </div>

                <div className="catalog-item-details">
                  <div className="catalog-item-title">{track.title}</div>
                  <div className="catalog-item-artist">{track.artist}</div>
                  <div className="catalog-item-vibe">🍃 {track.cozyVibe}</div>
                  <div className="catalog-item-meta">
                    <span>{track.genre}</span>
                    <span>•</span>
                    <span>{track.downloadSize}</span>
                  </div>

                  {isDownloading && (
                    <div className="download-progress-bar-wrap">
                      <div 
                        className="download-progress-fill" 
                        style={{ width: `${downloadProgress || 15}%` }}
                      ></div>
                    </div>
                  )}
                </div>

                <div className="catalog-item-action">
                  {isSaved ? (
                    <span className="saved-badge">
                      <Check size={14} /> Kept in App
                    </span>
                  ) : (
                    <button
                      className="download-pill-btn"
                      onClick={() => handleDownload(track)}
                      disabled={isDownloading}
                    >
                      {isDownloading ? (
                        <>
                          <Loader2 size={14} className="spin" />
                          <span>{downloadProgress}%</span>
                        </>
                      ) : (
                        <>
                          <Download size={14} />
                          <span>Save Offline</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Offline Generator Fallback */}
        <div className="offline-generator-card">
          <div className="generator-text">
            <strong>Offline Synthesizer</strong>
            <p>Generate a soothing ambient track instantly without any internet.</p>
          </div>
          <button 
            className="generator-btn"
            onClick={handleDownloadOfflineGenerated}
            disabled={isGeneratingProcedural}
          >
            {isGeneratingProcedural ? 'Creating...' : '+ Synthesize Track'}
          </button>
        </div>
      </div>
    </div>
  );
}
