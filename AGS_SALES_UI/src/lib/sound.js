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
    
    // Play 3 melodic chime notes (C5 - E5 - G5)
    const notes = [
      { freq: 523.25, time: 0, duration: 0.25 },     // C5
      { freq: 659.25, time: 0.15, duration: 0.3 },   // E5
      { freq: 783.99, time: 0.32, duration: 0.5 },   // G5
    ];

    notes.forEach(n => {
      const osc = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(n.freq, ctx.currentTime + n.time);
      
      gain.gain.setValueAtTime(0.4, ctx.currentTime + n.time);
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + n.time + n.duration);
      
      osc.connect(gain);
      gain.connect(ctx.destination);
      
      osc.start(ctx.currentTime + n.time);
      osc.stop(ctx.currentTime + n.time + n.duration);
    });
  } catch (e) {
    console.error('Error playing notification sound:', e);
  }
};
