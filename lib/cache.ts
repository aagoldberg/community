import { Redis } from "@upstash/redis";

const redis = new Redis({
  url: process.env.UPSTASH_REDIS_REST_URL!,
  token: process.env.UPSTASH_REDIS_REST_TOKEN!,
});

export interface DashboardCache {
  data: DashboardData;
  cachedAt: number;
}

export interface DashboardData {
  activation: { value: number; change: number };
  retention: { value: number; change: number };
  conversationDepth: { avgReplies: number; pctWithReplies: number };
  reciprocity: { replyBackRate: number; mutualDyads: number };
  agencyRate: { value: number; postsWithActionReplies: number };
  rageDensity: { value: number; count: number };
  positiveRate: { value: number };
  hopeIndex: { value: number; highPct: number }; // New: hope metric from emotion analysis
  topExamples: {
    rage: ExamplePost[];
    agency: ExamplePost[];
  };
}

export interface ExamplePost {
  hash: string;
  excerpt: string;
  timestamp: string;
  score: number;
}

const DASHBOARD_TTL = 900; // 15 minutes

export async function getCachedDashboard(
  fid: number,
  range: string
): Promise<DashboardData | null> {
  const key = `dashboard:${fid}:${range}`;
  const cached = await redis.get<DashboardCache>(key);

  if (!cached) return null;

  // Check if still valid
  const age = Date.now() - cached.cachedAt;
  if (age > DASHBOARD_TTL * 1000) return null;

  return cached.data;
}

export async function cacheDashboard(
  fid: number,
  range: string,
  data: DashboardData
): Promise<void> {
  const key = `dashboard:${fid}:${range}`;
  await redis.set<DashboardCache>(
    key,
    { data, cachedAt: Date.now() },
    { ex: DASHBOARD_TTL }
  );
}

export async function invalidateDashboardCache(fid: number): Promise<void> {
  const keys = [`dashboard:${fid}:7d`, `dashboard:${fid}:30d`];
  await Promise.all(keys.map((key) => redis.del(key)));
}

// Classification cache (permanent)
export interface ClassificationCache {
  sentiment: "positive" | "negative" | "neutral";
  hasAnger: boolean;
  angerConfidence: number;
  hasAgency: boolean;
}

export async function getCachedClassification(
  hash: string
): Promise<ClassificationCache | null> {
  return redis.get<ClassificationCache>(`class:${hash}`);
}

export async function cacheClassification(
  hash: string,
  data: ClassificationCache
): Promise<void> {
  // No TTL - classifications are immutable
  await redis.set(`class:${hash}`, data);
}

export async function getCachedClassifications(
  hashes: string[]
): Promise<Map<string, ClassificationCache>> {
  if (hashes.length === 0) return new Map();

  const keys = hashes.map((h) => `class:${h}`);
  const results = await redis.mget<(ClassificationCache | null)[]>(...keys);

  const map = new Map<string, ClassificationCache>();
  results.forEach((result, i) => {
    if (result) {
      map.set(hashes[i], result);
    }
  });

  return map;
}
