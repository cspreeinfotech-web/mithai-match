// Real vibration via @capacitor/haptics (no-ops harmlessly in a desktop browser, where the
// Haptics plugin isn't available — Capacitor's web fallback just resolves without vibrating).
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';
import { loadProfile } from './profile';

export const haptics = {
  async light(): Promise<void> {
    if (!loadProfile().hapticsOn) return;
    try {
      await Haptics.impact({ style: ImpactStyle.Light });
    } catch {
      // No native haptics available (browser/desktop) — fine to ignore.
    }
  },
  async success(): Promise<void> {
    if (!loadProfile().hapticsOn) return;
    try {
      await Haptics.notification({ type: NotificationType.Success });
    } catch {
      // ignore
    }
  },
  async error(): Promise<void> {
    if (!loadProfile().hapticsOn) return;
    try {
      await Haptics.notification({ type: NotificationType.Error });
    } catch {
      // ignore
    }
  },
};
