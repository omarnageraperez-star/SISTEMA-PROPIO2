/**
 * Web Audio API sound synthesizer for real-time notification alerts.
 * Generates clear, high-quality audio chimes without external audio asset dependencies.
 */

// Shared AudioContext to prevent multiple instances
let audioContext = null;

const getAudioContext = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return null;
    
    if (!audioContext) {
      audioContext = new AudioCtx();
    }
    
    if (audioContext.state === 'suspended') {
      audioContext.resume();
    }
    
    return audioContext;
  } catch (e) {
    console.error('Error getting AudioContext:', e);
    return null;
  }
};

const playCustomSequence = (notesSequence) => {
  try {
    const ctx = getAudioContext();
    if (!ctx) return;
    
    const playChimeSequence = (startTimeOffset = 0, sequence) => {
      sequence.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = n.type || 'sine';
        osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.time + startTimeOffset);
        
        gain.gain.setValueAtTime(0.001, ctx.currentTime + n.time + startTimeOffset);
        gain.gain.linearRampToValueAtTime(n.vol, ctx.currentTime + n.time + startTimeOffset + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.time + startTimeOffset + n.duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + n.time + startTimeOffset);
        osc.stop(ctx.currentTime + n.time + startTimeOffset + n.duration);
      });
    };

    playChimeSequence(0, notesSequence);
  } catch (e) {
    console.error('Error playing notification sound:', e);
  }
};

// DINE_IN: Elegant soft chime
export const playOrderDineIn = () => {
  playCustomSequence([
    { freq: 523.25, time: 0.00, duration: 0.2, vol: 0.4 },  // C5
    { freq: 659.25, time: 0.15, duration: 0.2, vol: 0.45 }, // E5
    { freq: 783.99, time: 0.30, duration: 0.4, vol: 0.5 },  // G5
  ]);
};

// TAKEOUT: Fast double chime
export const playOrderTakeout = () => {
  playCustomSequence([
    { freq: 880.00, time: 0.00, duration: 0.15, vol: 0.5 },  // A5
    { freq: 1046.50, time: 0.10, duration: 0.25, vol: 0.6 }, // C6
    { freq: 880.00, time: 0.40, duration: 0.15, vol: 0.5 },  // A5
    { freq: 1046.50, time: 0.50, duration: 0.25, vol: 0.6 }, // C6
  ]);
};

// DELIVERY: Longer ringtone like a phone or bell
export const playOrderDelivery = () => {
  playCustomSequence([
    { freq: 587.33, time: 0.00, duration: 0.15, vol: 0.5, type: 'triangle' }, // D5
    { freq: 739.99, time: 0.15, duration: 0.15, vol: 0.5, type: 'triangle' }, // F#5
    { freq: 880.00, time: 0.30, duration: 0.15, vol: 0.5, type: 'triangle' }, // A5
    { freq: 587.33, time: 0.60, duration: 0.15, vol: 0.5, type: 'triangle' }, // D5
    { freq: 739.99, time: 0.75, duration: 0.15, vol: 0.5, type: 'triangle' }, // F#5
    { freq: 880.00, time: 0.90, duration: 0.40, vol: 0.6, type: 'triangle' }, // A5
  ]);
};

// Fallback old function in case it's imported elsewhere
export const playNewOrderSound = playOrderDineIn;

// URGENT ALERT: Loud, fast repeating square wave
export const playUrgentAlert = () => {
  playCustomSequence([
    { freq: 440.00, time: 0.00, duration: 0.1, vol: 0.8, type: 'square' },
    { freq: 440.00, time: 0.15, duration: 0.1, vol: 0.8, type: 'square' },
    { freq: 440.00, time: 0.30, duration: 0.1, vol: 0.8, type: 'square' },
    { freq: 880.00, time: 0.45, duration: 0.3, vol: 0.9, type: 'square' },
  ]);
};
