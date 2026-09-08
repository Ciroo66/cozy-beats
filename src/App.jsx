import React, { useState, useEffect, useRef } from 'react';
import { 
  Radio, 
  HardDrive, 
  Sparkles, 
  CloudRain, 
  Moon, 
  Smartphone, 
  Maximize2, 
  Coffee
} from 'lucide-react';
import YoutubeIcon from './components/YoutubeIcon';
import CassetteDeck from './components/CassetteDeck';
import PlayerControls from './components/PlayerControls';
import OfflineLibrary from './components/OfflineLibrary';
import DiscoverModal from './components/DiscoverModal';
import AmbientMixer from './components/AmbientMixer';
import SleepTimerModal from './components/SleepTimerModal';
import YouTubeConverterModal from './components/YouTubeConverterModal';
import PlaylistModal from './components/PlaylistModal';

import { 
  getAllOfflineTracks, 
  deleteOfflineTrack, 
  toggleTrackFavorite, 
  getStorageEstimate,
  saveTrackOffline,
  getAllPlaylists,
  createPlaylist,
  updatePlaylist,
  deletePlaylist,
  addTrackToPlaylist,
  removeTrackFromPlaylist
} from './services/storage';
import { SAMPLE_TRACKS, createOfflineSoothingTrackBlob } from './services/sampleTracks';

export default function App() {
  // Navigation & View states
  const [activeTab, setActiveTab] = useState('player'); // 'player' | 'library'
  const [viewMode, setViewMode] = useState('cassette'); // 'cassette' | 'vinyl'
  const [isDiscoverOpen, setIsDiscoverOpen] = useState(false);
  const [isAmbientOpen, setIsAmbientOpen] = useState(false);
  const [isTimerOpen, setIsTimerOpen] = useState(false);
  const [isYouTubeOpen, setIsYouTubeOpen] = useState(false);
  const [isMobileFrame, setIsMobileFrame] = useState(true);

  // Library & Storage state
  const [tracks, setTracks] = useState([]);
  const [savedTrackIds, setSavedTrackIds] = useState(new Set());
  const [storageInfo, setStorageInfo] = useState(null);
  const [playlists, setPlaylists] = useState([]);
  const [isPlaylistModalOpen, setIsPlaylistModalOpen] = useState(false);
  const [playlistToEdit, setPlaylistToEdit] = useState(null);

  // Playback state
  const [currentTrackIndex, setCurrentTrackIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.85);
  const [isMuted, setIsMuted] = useState(false);
  const [isShuffle, setIsShuffle] = useState(false);
  const [repeatMode, setRepeatMode] = useState('all'); // 'off' | 'all' | 'one'
  const [blobUrl, setBlobUrl] = useState(null);

  // Previewing in discover modal
  const [previewTrack, setPreviewTrack] = useState(null);
  const [isPreviewPlaying, setIsPreviewPlaying] = useState(false);

  // Sleep Timer state
  const [activeTimerMinutes, setActiveTimerMinutes] = useState(null);
  const [timerRemainingSeconds, setTimerRemainingSeconds] = useState(0);

  // Audio elements
  const audioRef = useRef(new Audio());
  const previewAudioRef = useRef(new Audio());
  const timerIntervalRef = useRef(null);

  const currentTrack = tracks[currentTrackIndex] || null;

  // Initialize offline tracks and storage stats
  const refreshLibrary = async () => {
    try {
      const stored = await getAllOfflineTracks();
      
      // If first time open and completely empty, seed with 1 offline procedural track so user can play right away!
      if (stored.length === 0) {
        const defaultBlob = createOfflineSoothingTrackBlob('Morning Sunlight (Offline)');
        const defaultTrack = {
          id: 'initial_offline_01',
          title: 'Morning Sunlight (Offline)',
          artist: 'Cozy Pocket Tape',
          duration: 16,
          genre: 'Lo-Fi Chill',
          cozyColor: '#8a6552',
          cozyVibe: 'calm tea on a rainy morning',
          coverArt: SAMPLE_TRACKS[0].coverArt
        };
        const saved = await saveTrackOffline(defaultTrack, defaultBlob);
        stored.push(saved);
      }

      setTracks(stored);
      setSavedTrackIds(new Set(stored.map((t) => t.id)));

      const storedPlaylists = await getAllPlaylists();
      setPlaylists(storedPlaylists);

      const estimate = await getStorageEstimate();
      setStorageInfo(estimate);
    } catch (err) {
      console.error('Error loading library:', err);
    }
  };

  useEffect(() => {
    refreshLibrary();
  }, []);

  // Update Media Session API for Android Lock Screen & Notification Shade
  useEffect(() => {
    if ('mediaSession' in navigator && currentTrack) {
      navigator.mediaSession.metadata = new MediaMetadata({
        title: currentTrack.title,
        artist: currentTrack.artist,
        album: currentTrack.genre || 'Cozy Beats Offline',
        artwork: [
          {
            src: currentTrack.coverArt || '/vinyl-icon.svg',
            sizes: '512x512',
            type: 'image/jpeg'
          }
        ]
      });

      navigator.mediaSession.setActionHandler('play', () => handlePlay());
      navigator.mediaSession.setActionHandler('pause', () => handlePause());
      navigator.mediaSession.setActionHandler('previoustrack', () => handlePrev());
      navigator.mediaSession.setActionHandler('nexttrack', () => handleNext());
      navigator.mediaSession.setActionHandler('seekto', (details) => {
        if (details.seekTime && audioRef.current) {
          audioRef.current.currentTime = details.seekTime;
        }
      });
    }
  }, [currentTrack]);

  // Load track source into Audio element
  useEffect(() => {
    if (!currentTrack) return;

    const audio = audioRef.current;
    
    // Revoke previous blob URL if any
    if (blobUrl) {
      URL.revokeObjectURL(blobUrl);
      setBlobUrl(null);
    }

    let urlToPlay;
    if (currentTrack.audioBlob) {
      urlToPlay = URL.createObjectURL(currentTrack.audioBlob);
      setBlobUrl(urlToPlay);
    } else if (currentTrack.url) {
      urlToPlay = currentTrack.url;
    }

    if (urlToPlay) {
      audio.src = urlToPlay;
      audio.volume = isMuted ? 0 : volume;
      audio.load();

      if (isPlaying) {
        audio.play().catch((e) => {
          console.warn('Playback blocked or failed', e);
          setIsPlaying(false);
        });
      }
    }
  }, [currentTrackIndex, tracks]);

  // Audio Event Listeners
  useEffect(() => {
    const audio = audioRef.current;

    const updateTime = () => setCurrentTime(audio.currentTime);
    const updateDuration = () => setDuration(audio.duration || currentTrack?.duration || 0);
    
    const handleEnded = () => {
      if (activeTimerMinutes === 'track') {
        handlePause();
        setActiveTimerMinutes(null);
        return;
      }

      if (repeatMode === 'one') {
        audio.currentTime = 0;
        audio.play();
      } else if (repeatMode === 'all' || isShuffle) {
        handleNext();
      } else {
        setIsPlaying(false);
      }
    };

    audio.addEventListener('timeupdate', updateTime);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', handleEnded);

    return () => {
      audio.removeEventListener('timeupdate', updateTime);
      audio.removeEventListener('loadedmetadata', updateDuration);
      audio.removeEventListener('ended', handleEnded);
    };
  }, [repeatMode, isShuffle, activeTimerMinutes, tracks.length, currentTrackIndex]);

  // Handle Play/Pause
  const handlePlay = () => {
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setIsPreviewPlaying(false);

    audioRef.current.play()
      .then(() => setIsPlaying(true))
      .catch((e) => console.warn('Play error:', e));
  };

  const handlePause = () => {
    audioRef.current.pause();
    setIsPlaying(false);
  };

  const handleTogglePlay = () => {
    if (isPlaying) {
      handlePause();
    } else {
      handlePlay();
    }
  };

  // Next Track
  const handleNext = () => {
    if (tracks.length === 0) return;
    if (isShuffle) {
      const nextIdx = Math.floor(Math.random() * tracks.length);
      setCurrentTrackIndex(nextIdx);
    } else {
      setCurrentTrackIndex((prev) => (prev + 1) % tracks.length);
    }
    setCurrentTime(0);
    setIsPlaying(true);
  };

  // Previous Track
  const handlePrev = () => {
    if (tracks.length === 0) return;
    if (currentTime > 3) {
      audioRef.current.currentTime = 0;
      setCurrentTime(0);
    } else {
      setCurrentTrackIndex((prev) => (prev - 1 + tracks.length) % tracks.length);
      setCurrentTime(0);
      setIsPlaying(true);
    }
  };

  // Seek
  const handleSeek = (newTime) => {
    if (audioRef.current) {
      audioRef.current.currentTime = newTime;
      setCurrentTime(newTime);
    }
  };

  // Volume & Mute
  const handleVolumeChange = (newVol) => {
    setVolume(newVol);
    setIsMuted(false);
    if (audioRef.current) {
      audioRef.current.volume = newVol;
    }
  };

  const handleToggleMute = () => {
    const nextMute = !isMuted;
    setIsMuted(nextMute);
    if (audioRef.current) {
      audioRef.current.volume = nextMute ? 0 : volume;
    }
  };

  // Shuffle & Repeat
  const handleToggleShuffle = () => setIsShuffle(!isShuffle);
  const handleToggleRepeat = () => {
    if (repeatMode === 'off') setRepeatMode('all');
    else if (repeatMode === 'all') setRepeatMode('one');
    else setRepeatMode('off');
  };

  // Toggle Favorite
  const handleToggleFavorite = async (trackId) => {
    const id = trackId || currentTrack?.id;
    if (!id) return;
    await toggleTrackFavorite(id);
    await refreshLibrary();
  };

  // Delete Track
  const handleDeleteTrack = async (trackId) => {
    if (window.confirm('Remove this track from offline storage?')) {
      await deleteOfflineTrack(trackId);
      await refreshLibrary();
    }
  };

  // Play Specific Track from Library or Modal
  const handlePlaySpecificTrack = async (track) => {
    if (!track) return;

    let currentTracks = tracks;
    let idx = currentTracks.findIndex((t) => t.id === track.id);

    if (idx === -1) {
      try {
        const offlineTracks = await getAllOfflineTracks();
        currentTracks = [...COZY_LOFI_TRACKS, ...offlineTracks];
        setTracks(currentTracks);
        setSavedTrackIds(new Set(offlineTracks.map((t) => t.id)));
        idx = currentTracks.findIndex((t) => t.id === track.id);
      } catch (e) {
        console.warn('Error refreshing library for play track:', e);
      }
    }

    const targetTrack = (idx !== -1 ? currentTracks[idx] : track) || track;

    if (idx === -1) {
      setTracks((prev) => [track, ...prev]);
      idx = 0;
    }

    setCurrentTrackIndex(idx);
    setIsPlaying(true);
    setActiveTab('player');

    // Directly load and trigger play immediately (no need to refresh or switch tabs)
    if (previewAudioRef.current) previewAudioRef.current.pause();
    setIsPreviewPlaying(false);

    const audio = audioRef.current;
    if (audio) {
      let urlToPlay;
      if (targetTrack.audioBlob) {
        urlToPlay = URL.createObjectURL(targetTrack.audioBlob);
        setBlobUrl(urlToPlay);
      } else if (targetTrack.url) {
        urlToPlay = targetTrack.url;
      }

      if (urlToPlay) {
        audio.src = urlToPlay;
        audio.volume = isMuted ? 0 : volume;
        audio.load();
        audio.play().catch((err) => console.warn('Direct play error:', err));
      }
    }
  };

  // Sleep Timer Handler
  const handleSetTimer = (minutes) => {
    if (minutes === 'track') {
      setActiveTimerMinutes('track');
      setTimerRemainingSeconds(Math.max(0, Math.floor(duration - currentTime)));
      return;
    }

    setActiveTimerMinutes(minutes);
    const totalSeconds = minutes * 60;
    setTimerRemainingSeconds(totalSeconds);

    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);

    timerIntervalRef.current = setInterval(() => {
      setTimerRemainingSeconds((prev) => {
        if (prev <= 1) {
          clearInterval(timerIntervalRef.current);
          handlePause();
          setActiveTimerMinutes(null);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  const handleCancelTimer = () => {
    if (timerIntervalRef.current) clearInterval(timerIntervalRef.current);
    setActiveTimerMinutes(null);
    setTimerRemainingSeconds(0);
  };

  // Preview Track in Discover Modal
  const handlePreviewTrack = (track) => {
    const previewAudio = previewAudioRef.current;
    if (previewTrack?.id === track.id && isPreviewPlaying) {
      previewAudio.pause();
      setIsPreviewPlaying(false);
    } else {
      handlePause(); // pause main player
      previewAudio.src = track.url;
      previewAudio.play().then(() => {
        setPreviewTrack(track);
        setIsPreviewPlaying(true);
      }).catch(console.warn);

      previewAudio.onended = () => setIsPreviewPlaying(false);
    }
  };

  // Playlist actions
  const handleSavePlaylist = async (playlistData) => {
    if (playlistData.id) {
      await updatePlaylist(playlistData);
    } else {
      await createPlaylist(playlistData);
    }
    await refreshLibrary();
  };

  const handleDeletePlaylist = async (playlistId) => {
    if (window.confirm('Delete this custom mixtape? (Tracks will remain safe in your library)')) {
      await deletePlaylist(playlistId);
      await refreshLibrary();
    }
  };

  const handleToggleTrackInPlaylist = async (playlistId, trackId) => {
    const pl = playlists.find((p) => p.id === playlistId);
    if (!pl) return;
    if ((pl.trackIds || []).includes(trackId)) {
      await removeTrackFromPlaylist(playlistId, trackId);
    } else {
      await addTrackToPlaylist(playlistId, trackId);
    }
    await refreshLibrary();
  };

  const handleRemoveTrackFromPlaylist = async (playlistId, trackId) => {
    await removeTrackFromPlaylist(playlistId, trackId);
    await refreshLibrary();
  };

  const handlePlayPlaylist = (playlist) => {
    if (!playlist || !playlist.trackIds || playlist.trackIds.length === 0) return;
    const firstTrackIdx = tracks.findIndex((t) => playlist.trackIds.includes(t.id));
    if (firstTrackIdx !== -1) {
      setCurrentTrackIndex(firstTrackIdx);
      setIsPlaying(true);
      setActiveTab('player');
    }
  };

  const trackProgress = duration > 0 ? currentTime / duration : 0;

  return (
    <div className="app-viewport-wrapper">
      <div className={`android-phone-frame ${!isMobileFrame ? 'expanded-view' : ''}`}>
        {/* Soft Ambient Light */}
        <div className="warm-ambient-glow" />

        {/* Top Header Bar */}
        <header className="cozy-top-bar">
          <div className="brand-badge">
            <span className="brand-icon">📻</span>
            <span className="brand-title">Cozy Beats</span>
          </div>

          <div className="top-bar-actions">
            {/* YouTube Tape Dubber */}
            <button 
              className="icon-pill-btn yt-pill-action"
              onClick={() => setIsYouTubeOpen(true)}
              title="Convert YouTube URL to Offline Tape"
            >
              <YoutubeIcon size={14} className="text-red-icon" />
              <span>YT Dub</span>
            </button>

            {/* Bedtime Sleep Timer Button */}
            <button 
              className={`icon-pill-btn ${activeTimerMinutes ? 'active' : ''}`}
              onClick={() => setIsTimerOpen(true)}
              title="Sleep Timer"
            >
              <Moon size={14} />
              <span>{activeTimerMinutes ? `${Math.ceil(timerRemainingSeconds / 60)}m` : 'Sleep'}</span>
            </button>

            {/* Desktop frame expander toggle (hidden on mobile devices) */}
            <button 
              className="icon-pill-btn desktop-only-btn"
              onClick={() => setIsMobileFrame(!isMobileFrame)}
              title={isMobileFrame ? 'Expand width' : 'Android phone size'}
            >
              {isMobileFrame ? <Maximize2 size={13} /> : <Smartphone size={13} />}
            </button>
          </div>
        </header>

        {/* Main Content Area */}
        <main className="app-screen-body">
          {activeTab === 'player' ? (
            <>
              {/* Cassette / Turntable Visualizer */}
              <CassetteDeck
                currentTrack={currentTrack}
                isPlaying={isPlaying}
                progress={trackProgress}
                viewMode={viewMode}
                onToggleViewMode={setViewMode}
              />

              {/* Full Tactile Audio Controls */}
              <PlayerControls
                isPlaying={isPlaying}
                currentTime={currentTime}
                duration={duration}
                volume={volume}
                isMuted={isMuted}
                isShuffle={isShuffle}
                repeatMode={repeatMode}
                isFavorite={!!currentTrack?.isFavorite}
                onPlayPause={handleTogglePlay}
                onNext={handleNext}
                onPrev={handlePrev}
                onSeek={handleSeek}
                onVolumeChange={handleVolumeChange}
                onToggleMute={handleToggleMute}
                onToggleShuffle={handleToggleShuffle}
                onToggleRepeat={handleToggleRepeat}
                onToggleFavorite={() => handleToggleFavorite(currentTrack?.id)}
              />
            </>
          ) : (
            /* Offline Pocket Storage Tab */
            <OfflineLibrary
              tracks={tracks}
              currentTrack={currentTrack}
              isPlaying={isPlaying}
              storageInfo={storageInfo}
              onPlayTrack={handlePlaySpecificTrack}
              onDeleteTrack={handleDeleteTrack}
              onToggleFavorite={handleToggleFavorite}
              onTrackImported={async () => {
                await refreshLibrary();
              }}
              onOpenDiscover={() => setIsDiscoverOpen(true)}
              onOpenYouTubeConverter={() => setIsYouTubeOpen(true)}
              playlists={playlists}
              onPlayPlaylist={handlePlayPlaylist}
              onOpenCreatePlaylist={() => {
                setPlaylistToEdit(null);
                setIsPlaylistModalOpen(true);
              }}
              onOpenEditPlaylist={(pl) => {
                setPlaylistToEdit(pl);
                setIsPlaylistModalOpen(true);
              }}
              onDeletePlaylist={handleDeletePlaylist}
              onToggleTrackInPlaylist={handleToggleTrackInPlaylist}
              onRemoveTrackFromPlaylist={handleRemoveTrackFromPlaylist}
            />
          )}
        </main>

        {/* Bottom Mobile Navigation Tabs */}
        <nav className="cozy-bottom-nav">
          <button 
            className={`nav-tab-btn ${activeTab === 'player' ? 'active' : ''}`}
            onClick={() => setActiveTab('player')}
          >
            <Radio size={19} className="nav-tab-icon" />
            <span>Tape Deck</span>
          </button>

          <button 
            className={`nav-tab-btn ${activeTab === 'library' ? 'active' : ''}`}
            onClick={() => setActiveTab('library')}
          >
            <HardDrive size={19} className="nav-tab-icon" />
            <span>Offline Box</span>
          </button>

          <button 
            className="nav-tab-btn"
            onClick={() => setIsAmbientOpen(true)}
          >
            <CloudRain size={19} className="nav-tab-icon" />
            <span>Rain & Fire</span>
          </button>

          <button 
            className="nav-tab-btn"
            onClick={() => setIsDiscoverOpen(true)}
          >
            <Sparkles size={19} className="nav-tab-icon" />
            <span>Get Beats</span>
          </button>
        </nav>

        {/* Modals */}
        <DiscoverModal
          isOpen={isDiscoverOpen}
          onClose={() => {
            setIsDiscoverOpen(false);
            if (previewAudioRef.current) previewAudioRef.current.pause();
            setIsPreviewPlaying(false);
          }}
          savedTrackIds={savedTrackIds}
          onTrackSaved={async () => {
            await refreshLibrary();
          }}
          onPreviewTrack={handlePreviewTrack}
          previewingTrackId={previewTrack?.id}
          isPreviewPlaying={isPreviewPlaying}
        />

        <AmbientMixer
          isOpen={isAmbientOpen}
          onClose={() => setIsAmbientOpen(false)}
        />

        <SleepTimerModal
          isOpen={isTimerOpen}
          onClose={() => setIsTimerOpen(false)}
          activeTimerMinutes={activeTimerMinutes}
          remainingSeconds={timerRemainingSeconds}
          onSetTimer={handleSetTimer}
          onCancelTimer={handleCancelTimer}
        />

        <YouTubeConverterModal
          isOpen={isYouTubeOpen}
          onClose={() => setIsYouTubeOpen(false)}
          onTrackSaved={async () => {
            await refreshLibrary();
          }}
          onPlayNow={(track) => {
            handlePlaySpecificTrack(track);
          }}
        />

        <PlaylistModal
          isOpen={isPlaylistModalOpen}
          onClose={() => {
            setIsPlaylistModalOpen(false);
            setPlaylistToEdit(null);
          }}
          allTracks={tracks}
          playlistToEdit={playlistToEdit}
          onSavePlaylist={handleSavePlaylist}
        />
      </div>
    </div>
  );
}
