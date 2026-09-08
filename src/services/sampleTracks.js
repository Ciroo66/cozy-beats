/**
 * Curated catalog of chill, cozy, lofi & acoustic beats available for instant
 * offline download or online streaming.
 */

export const SAMPLE_TRACKS = [
  {
    id: 'chill_tape_01',
    title: 'Warm Tea & Rainy Afternoon',
    artist: 'Coffee House Beats',
    album: 'Rainy Day In Kyoto',
    duration: 165,
    genre: 'Lo-Fi Chillhop',
    cozyColor: '#8a6552',
    cozyVibe: 'soft rain tapping on wooden window frames',
    coverArt: 'https://images.unsplash.com/photo-1518495973542-4542c06a5843?auto=format&fit=crop&w=400&q=80',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/27/audio_1808fbf07a.mp3?filename=lofi-study-112191.mp3',
    downloadSize: '2.8 MB'
  },
  {
    id: 'chill_tape_02',
    title: 'Late Night Cat Nap',
    artist: 'Sleepy Pillow',
    album: 'Midnight Blanket',
    duration: 142,
    genre: 'Bedroom Lo-Fi',
    cozyColor: '#6d7967',
    cozyVibe: 'curled under heavy blankets with a warm cat',
    coverArt: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?auto=format&fit=crop&w=400&q=80',
    url: 'https://cdn.pixabay.com/download/audio/2022/10/14/audio_9939f792cb.mp3?filename=lofi-chill-medium-version-120485.mp3',
    downloadSize: '2.4 MB'
  },
  {
    id: 'chill_tape_03',
    title: 'Vintage Bookstore Smell',
    artist: 'Old Paper Jazz',
    album: 'Dusty Shelves',
    duration: 180,
    genre: 'Jazzhop & Nostalgia',
    cozyColor: '#a2704f',
    cozyVibe: 'turning yellowed pages in a quiet corner',
    coverArt: 'https://images.unsplash.com/photo-1507842229451-79b1be8d6293?auto=format&fit=crop&w=400&q=80',
    url: 'https://cdn.pixabay.com/download/audio/2022/01/18/audio_d0a13f69d2.mp3?filename=relaxed-vlog-131746.mp3',
    downloadSize: '3.1 MB'
  },
  {
    id: 'chill_tape_04',
    title: 'Campfire Glow',
    artist: 'Autumn Breeze',
    album: 'Folk & Embers',
    duration: 195,
    genre: 'Acoustic Ambient',
    cozyColor: '#b05e3b',
    cozyVibe: 'crackling logs under a starlit pine forest',
    coverArt: 'https://images.unsplash.com/photo-1470246973918-29a93221c455?auto=format&fit=crop&w=400&q=80',
    url: 'https://cdn.pixabay.com/download/audio/2022/03/15/audio_c8c8a73467.mp3?filename=spirit-blossom-15285.mp3',
    downloadSize: '3.3 MB'
  },
  {
    id: 'chill_tape_05',
    title: 'Morning Matcha & Sunrise',
    artist: 'Bonsai Dreams',
    album: 'Garden Sunlight',
    duration: 154,
    genre: 'Chillhop',
    cozyColor: '#7a8450',
    cozyVibe: 'golden morning light on warm green ceramic',
    coverArt: 'https://images.unsplash.com/photo-1544787219-7f47ccb76574?auto=format&fit=crop&w=400&q=80',
    url: 'https://cdn.pixabay.com/download/audio/2022/05/16/audio_db6591201e.mp3?filename=lofi-alarm-clock-111666.mp3',
    downloadSize: '2.6 MB'
  }
];

/**
 * Generate a procedural gentle soothing chime sound as an offline audio Blob
 * In case user is completely offline without internet on first launch.
 */
export function createOfflineSoothingTrackBlob(title = 'Gentle Lofi Chimes') {
  const sampleRate = 44100;
  const durationSec = 16; // loopable chill ambient tone
  const numSamples = sampleRate * durationSec;
  const buffer = new Float32Array(numSamples);

  // Pentatonic scale chords (E major pentatonic: E4, F#4, G#4, B4, C#5)
  const freqs = [329.63, 369.99, 415.30, 493.88, 554.37];
  
  for (let i = 0; i < numSamples; i++) {
    const t = i / sampleRate;
    let sample = 0;
    
    // Play mellow arpeggiated bells
    freqs.forEach((freq, idx) => {
      const notePeriod = 4; // every 4 seconds
      const noteOffset = idx * 0.8;
      const noteTime = (t - noteOffset) % notePeriod;
      if (noteTime > 0) {
        const envelope = Math.exp(-noteTime * 2.2);
        // fundamental + soft harmonic
        sample += Math.sin(2 * Math.PI * freq * t) * envelope * 0.15;
        sample += Math.sin(2 * Math.PI * freq * 2 * t) * envelope * 0.05;
      }
    });

    // Add warm vinyl dust & low drone
    sample += (Math.sin(2 * Math.PI * 110 * t) * 0.04);
    sample += (Math.random() * 2 - 1) * 0.005;

    buffer[i] = Math.max(-1, Math.min(1, sample));
  }

  // Convert Float32Array to 16-bit PCM WAV Blob
  const wavBytes = encodeWav(buffer, sampleRate);
  return new Blob([wavBytes], { type: 'audio/wav' });
}

function encodeWav(samples, sampleRate) {
  const buffer = new ArrayBuffer(44 + samples.length * 2);
  const view = new DataView(buffer);

  /* RIFF identifier */
  writeString(view, 0, 'RIFF');
  /* file length */
  view.setUint32(4, 36 + samples.length * 2, true);
  /* RIFF type */
  writeString(view, 8, 'WAVE');
  /* format chunk identifier */
  writeString(view, 12, 'fmt ');
  /* format chunk length */
  view.setUint32(16, 16, true);
  /* sample format (raw) */
  view.setUint16(20, 1, true);
  /* channel count */
  view.setUint16(22, 1, true);
  /* sample rate */
  view.setUint32(24, sampleRate, true);
  /* byte rate (sample rate * block align) */
  view.setUint32(28, sampleRate * 2, true);
  /* block align (channel count * bytes per sample) */
  view.setUint16(32, 2, true);
  /* bits per sample */
  view.setUint16(34, 16, true);
  /* data chunk identifier */
  writeString(view, 36, 'data');
  /* data chunk length */
  view.setUint32(40, samples.length * 2, true);

  // Write PCM samples
  let offset = 44;
  for (let i = 0; i < samples.length; i++) {
    const s = Math.max(-1, Math.min(1, samples[i]));
    view.setInt16(offset, s < 0 ? s * 0x8000 : s * 0x7fff, true);
    offset += 2;
  }

  return buffer;
}

function writeString(view, offset, string) {
  for (let i = 0; i < string.length; i++) {
    view.setUint8(offset + i, string.charCodeAt(i));
  }
}
