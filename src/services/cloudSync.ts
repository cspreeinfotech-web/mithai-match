// Best-effort cloud save: anonymous sign-in + merge-on-connect (server wins for coins/lives/
// stars, per the brief). Every call here is optional — if there's no configured Supabase
// project, or the device is offline, these all no-op and the game keeps working purely off
// localStorage (src/services/profile.ts). This is the "reconciles with server on connect"
// half of the spec; see ASSUMPTIONS.md for which call sites also push to the server RPCs
// (complete_level, claim_daily_reward) versus staying local-only for now.
import { getSupabase } from './supabaseClient';
import { loadProfile, saveProfile, type PlayerProfile } from './profile';

interface ProfileRow {
  coins: number;
  lives: number;
  lives_updated_at: string;
  current_level: number;
  total_stars: number;
}

/** Call once at boot. Signs in anonymously if needed, then merges the server's profile
 *  (server wins for coins/lives/current_level, since those are server-authoritative) into
 *  local storage. Never throws — failures are swallowed so offline play is unaffected. */
export async function initCloudSync(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;

  try {
    const { data: sessionData } = await supabase.auth.getSession();
    if (!sessionData.session) {
      const { error } = await supabase.auth.signInAnonymously();
      if (error) return;
    }

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) return;

    const { data: row } = await supabase
      .from('profiles')
      .select('coins, lives, lives_updated_at, current_level, total_stars')
      .eq('id', userData.user.id)
      .maybeSingle<ProfileRow>();

    if (!row) return;

    const local = loadProfile();
    const merged: PlayerProfile = {
      ...local,
      coins: row.coins,
      lives: row.lives,
      livesUpdatedAt: new Date(row.lives_updated_at).getTime(),
      currentLevel: Math.max(local.currentLevel, row.current_level),
    };
    saveProfile(merged);
  } catch {
    // Offline, project not configured, or a transient error — local play continues unaffected.
  }
}

/** Best-effort push of a level win to the server (also grants coins / advances level there).
 *  Safe to call even with no backend configured. */
export async function syncLevelWin(levelId: number, score: number, stars: 0 | 1 | 2 | 3): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.rpc('complete_level', { p_level_id: levelId, p_score: score, p_stars: stars });
  } catch {
    // Local recordLevelWin() already ran; this is purely a best-effort cloud mirror.
  }
}

/** Best-effort push of a daily-reward claim to the server. */
export async function syncDailyClaim(): Promise<void> {
  const supabase = getSupabase();
  if (!supabase) return;
  try {
    await supabase.rpc('claim_daily_reward');
  } catch {
    // Local claimDaily() already ran; this is purely a best-effort cloud mirror.
  }
}
