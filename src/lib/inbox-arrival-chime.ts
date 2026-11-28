/** Pitido suave al llegar un mensaje (sin archivo de audio). */
export function playInboxArrivalChime() {
  if (typeof window === "undefined") return;
  const AudioCtx =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
  if (!AudioCtx) return;
  try {
    const ctx = new AudioCtx();
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = "sine";
    osc.frequency.value = 880;
    gain.gain.value = 0.035;
    osc.connect(gain);
    gain.connect(ctx.destination);
    const now = ctx.currentTime;
    osc.start(now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 0.16);
    osc.stop(now + 0.18);
    osc.onended = () => {
      void ctx.close().catch(() => undefined);
    };
  } catch {
    // Autoplay / AudioContext bloqueado: el toast sigue bastando.
  }
}
