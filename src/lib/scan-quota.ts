import AsyncStorage from "@react-native-async-storage/async-storage";

// Free-tier daily scan quota. v2 spec: 5 scans / 24h, resets at local midnight.
// Pro users (when IAP lands) bypass entirely via isPro().

const QUOTA_KEY = "minty_scan_quota";
const PRO_KEY = "minty_is_pro";
export const FREE_DAILY_LIMIT = 5;

interface QuotaRecord {
  date: string; // YYYY-MM-DD in local time
  count: number;
}

export interface QuotaSnapshot {
  used: number;
  limit: number;
  remaining: number;
  isPro: boolean;
}

function todayKey(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${m}-${day}`;
}

async function readQuota(): Promise<QuotaRecord> {
  try {
    const raw = await AsyncStorage.getItem(QUOTA_KEY);
    if (!raw) return { date: todayKey(), count: 0 };
    const parsed = JSON.parse(raw) as QuotaRecord;
    // Stale-day record → reset.
    if (parsed.date !== todayKey()) return { date: todayKey(), count: 0 };
    return parsed;
  } catch {
    return { date: todayKey(), count: 0 };
  }
}

export async function isPro(): Promise<boolean> {
  // Placeholder until RevenueCat / IAP is wired. Settable via setPro() for QA.
  try {
    return (await AsyncStorage.getItem(PRO_KEY)) === "1";
  } catch {
    return false;
  }
}

export async function setPro(value: boolean): Promise<void> {
  await AsyncStorage.setItem(PRO_KEY, value ? "1" : "0");
}

export async function getQuota(): Promise<QuotaSnapshot> {
  const pro = await isPro();
  if (pro) {
    return { used: 0, limit: Infinity, remaining: Infinity, isPro: true };
  }
  const rec = await readQuota();
  const used = Math.min(rec.count, FREE_DAILY_LIMIT);
  return {
    used,
    limit: FREE_DAILY_LIMIT,
    remaining: Math.max(0, FREE_DAILY_LIMIT - used),
    isPro: false,
  };
}

/** True iff the caller may start another scan right now. */
export async function canScan(): Promise<boolean> {
  const q = await getQuota();
  return q.isPro || q.remaining > 0;
}

/** Call after a successful grade. Pro users are no-ops. */
export async function recordScan(): Promise<QuotaSnapshot> {
  if (await isPro()) return getQuota();
  const rec = await readQuota();
  const next: QuotaRecord = { date: rec.date, count: rec.count + 1 };
  try {
    await AsyncStorage.setItem(QUOTA_KEY, JSON.stringify(next));
  } catch {}
  return getQuota();
}
