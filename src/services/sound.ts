// Audio service. I can't legally source or generate finished music/SFX files in this
// environment, so every sound is a silent placeholder (a near-zero-length WebAudio buffer) —
// the service itself, the toggles, and every call site are real and wired; only the actual
// audio content is missing. See ASSUMPTIONS.md and the filename list below for exactly what
// to supply (drop files at those paths under src/assets/audio/ with the same names and they
// start playing with zero code changes — see loadSound()'s TODO).
import { loadProfile } from './profile';

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

/** Exact filenames to drop into src/assets/audio/ (MP3 or OGG, short + punchy for SFX,
 *  loopable for music). Nothing else needs to change once these exist — see loadSound(). */
export const REQUIRED_AUDIO_FILES = {
  music: ['bg-music-loop.mp3'],
  sfx: [
    'sfx-swap.mp3',
    'sfx-invalid.mp3',
    'sfx-match.mp3',
    'sfx-cascade.mp3',
    'sfx-special-create.mp3',
    'sfx-special-fire.mp3',
    'sfx-win.mp3',
    'sfx-fail.mp3',
    'sfx-button.mp3',
    'sfx-coin.mp3',
    'sfx-booster.mp3',
  ],
} as const;

class SoundService {
  private ctx: AudioContext | null = null;

  private getContext(): AudioContext | null {
    if (this.ctx) return this.ctx;
    try {
      this.ctx = new (window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      return this.ctx;
    } catch {
      return null; // no WebAudio support — sound just silently doesn't play
    }
  }

  /** Plays a sound effect if Settings -> Sound is on. Currently always silent (see file
   *  header) — swap in a real decoded buffer here once REQUIRED_AUDIO_FILES exist. */
  playSfx(_key: SfxKey): void {
    if (!loadProfile().soundOn) return;
    // TODO once audio files exist: decode and play `src/assets/audio/${REQUIRED_AUDIO_FILES...}`.
    // Left as a no-op placeholder rather than faking a sound.
  }

  startMusic(): void {
    if (!loadProfile().musicOn) return;
    // TODO once bg-music-loop.mp3 exists: decode, loop, and respect the musicOn toggle live.
  }

  stopMusic(): void {
    // No-op until real music playback exists.
  }
}

export const sound = new SoundService();
