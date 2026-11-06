// Audio service. Every SFX is an original, procedurally-rendered sound (src/assets/audio/) —
// no copied/ripped audio from any other game. Background music is a CC0 (public domain) loop
// from OpenGameArt.org ("Happy Clappy Loop" by OwlishMedia). WebAudio decodes + caches each
// buffer on first use and plays it instantly on repeat calls.
import { loadProfile } from './profile';
import swapUrl from '../assets/audio/sfx-swap.wav';
import invalidUrl from '../assets/audio/sfx-invalid.wav';
import matchUrl from '../assets/audio/sfx-match.wav';
import cascadeUrl from '../assets/audio/sfx-cascade.wav';
import specialCreateUrl from '../assets/audio/sfx-special-create.wav';
import specialFireUrl from '../assets/audio/sfx-special-fire.wav';
import winUrl from '../assets/audio/sfx-win.wav';
import failUrl from '../assets/audio/sfx-fail.wav';
import buttonUrl from '../assets/audio/sfx-button.wav';
import coinUrl from '../assets/audio/sfx-coin.wav';
import boosterUrl from '../assets/audio/sfx-booster.wav';
import musicUrl from '../assets/audio/bg-music-loop.wav';

export type SfxKey =
  | 'swap'
  | 'invalid'
  | 'match'
  | 'cascade'
  | 'special-create'
  | 'special-fire'
  | 'win'
  | 'fail'
  | 'button'
  | 'coin'
  | 'booster';

const SFX_URLS: Record<SfxKey, string> = {
  swap: swapUrl,
  invalid: invalidUrl,
  match: matchUrl,
  cascade: cascadeUrl,
  'special-create': specialCreateUrl,
  'special-fire': specialFireUrl,
  win: winUrl,
  fail: failUrl,
  button: buttonUrl,
  coin: coinUrl,
  booster: boosterUrl,
};

class SoundService {
  private ctx: AudioContext | null = null;
  private buffers = new Map<SfxKey, AudioBuffer>();
  private loading = new Map<SfxKey, Promise<AudioBuffer | null>>();
  private musicBuffer: AudioBuffer | null = null;
  private musicLoading: Promise<AudioBuffer | null> | null = null;
  private musicSource: AudioBufferSourceNode | null = null;

  private getContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      return this.ctx;
    } catch {
      return null; // no WebAudio support — sound just silently doesn't play
    }
  }

  private decode(ctx: AudioContext, url: string): Promise<AudioBuffer | null> {
    return fetch(url)
      .then((res) => res.arrayBuffer())
      .then((data) => ctx.decodeAudioData(data))
      .catch(() => null); // a missing/corrupt file just means that sound stays silent
  }

  private loadBuffer(ctx: AudioContext, key: SfxKey): Promise<AudioBuffer | null> {
    const cached = this.buffers.get(key);
    if (cached) return Promise.resolve(cached);
    const inFlight = this.loading.get(key);
    if (inFlight) return inFlight;

    const promise = this.decode(ctx, SFX_URLS[key]).then((buffer) => {
      if (buffer) this.buffers.set(key, buffer);
      return buffer;
    });
    this.loading.set(key, promise);
    return promise;
  }

  playSfx(key: SfxKey): void {
    if (!loadProfile().soundOn) return;
    const ctx = this.getContext();
    if (!ctx) return;
    void this.loadBuffer(ctx, key).then((buffer) => {
      if (!buffer) return;
      if (ctx.state === 'suspended') void ctx.resume(); // mobile browsers suspend until a user gesture
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.connect(ctx.destination);
      source.start();
    });
  }

  startMusic(): void {
    if (!loadProfile().musicOn || this.musicSource) return;
    const ctx = this.getContext();
    if (!ctx) return;

    const play = (buffer: AudioBuffer) => {
      if (!loadProfile().musicOn || this.musicSource) return; // toggle may have flipped mid-load
      if (ctx.state === 'suspended') void ctx.resume();
      const source = ctx.createBufferSource();
      source.buffer = buffer;
      source.loop = true;
      const gain = ctx.createGain();
      gain.gain.value = 0.35; // sits under SFX, never drowns them out
      source.connect(gain).connect(ctx.destination);
      source.start();
      this.musicSource = source;
    };

    if (this.musicBuffer) {
      play(this.musicBuffer);
      return;
    }
    this.musicLoading ??= this.decode(ctx, musicUrl).then((buffer) => {
      this.musicBuffer = buffer;
      return buffer;
    });
    void this.musicLoading.then((buffer) => buffer && play(buffer));
  }

  stopMusic(): void {
    this.musicSource?.stop();
    this.musicSource = null;
  }

  // Our AudioContext is independent of Phaser's own sound manager, so nothing stops it when
  // the app backgrounds unless we do it ourselves — this is what main.ts's app-lifecycle
  // listeners call, so music/SFX don't keep playing after the player leaves the app.
  suspendAll(): void {
    if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend();
  }

  resumeAll(): void {
    if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume();
  }
}

export const sound = new SoundService();
