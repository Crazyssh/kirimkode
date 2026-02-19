// iPhone-style notification sound using Web Audio API
export function playOtpSound() {
  try {
    const ctx = new AudioContext();

    // Note 1 - tri-tone like iPhone
    playTone(ctx, 880, 0, 0.12);   // A5
    playTone(ctx, 1108, 0.15, 0.12); // C#6
    playTone(ctx, 1320, 0.3, 0.15);  // E6

    // Cleanup
    setTimeout(() => ctx.close(), 1000);
  } catch {
    // Audio not supported
  }
}

function playTone(ctx: AudioContext, freq: number, startTime: number, duration: number) {
  const osc = ctx.createOscillator();
  const gain = ctx.createGain();

  osc.type = "sine";
  osc.frequency.value = freq;

  gain.gain.setValueAtTime(0, ctx.currentTime + startTime);
  gain.gain.linearRampToValueAtTime(0.3, ctx.currentTime + startTime + 0.02);
  gain.gain.linearRampToValueAtTime(0, ctx.currentTime + startTime + duration);

  osc.connect(gain);
  gain.connect(ctx.destination);

  osc.start(ctx.currentTime + startTime);
  osc.stop(ctx.currentTime + startTime + duration);
}
