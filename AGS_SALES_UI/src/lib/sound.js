/**
 * Web Audio API sound synthesizer for real-time notification alerts.
 * Generates clear, high-quality audio chimes without external audio asset dependencies.
 */
export const playNewOrderSound = () => {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) return;
    const ctx = new AudioCtx();
    
    if (ctx.state === 'suspended') {
      ctx.resume();
    }
    
    const playChimeSequence = (startTimeOffset = 0) => {
      // 3-note ascending chime (C5 - E5 - G5 - C6)
      const notes = [
        { freq: 523.25, time: startTimeOffset + 0.00, duration: 0.18, vol: 0.4 },  // C5
        { freq: 659.25, time: startTimeOffset + 0.12, duration: 0.18, vol: 0.45 }, // E5
        { freq: 783.99, time: startTimeOffset + 0.24, duration: 0.22, vol: 0.5 },  // G5
        { freq: 1046.50, time: startTimeOffset + 0.38, duration: 0.50, vol: 0.6 }  // C6 (High chime)
      ];

      notes.forEach(n => {
        const osc = ctx.createOscillator();
        const gain = ctx.createGain();
        
        osc.type = 'sine';
        osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.time);
        
        gain.gain.setValueAtTime(0.001, ctx.currentTime + n.time);
        gain.gain.linearRampToValueAtTime(n.vol, ctx.currentTime + n.time + 0.03);
        gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.time + n.duration);
        
        osc.connect(gain);
        gain.connect(ctx.destination);
        
        osc.start(ctx.currentTime + n.time);
        osc.stop(ctx.currentTime + n.time + n.duration);
      });
    };

    // Play chime once, then repeat 0.75 seconds later for a double alert chime
    playChimeSequence(0);
    playChimeSequence(0.75);
  } catch (e) {
    console.error('Error playing notification sound:', e);
  }
};
