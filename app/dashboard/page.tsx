"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { MetricCard } from "@/components/MetricCard";
import { DriverBar } from "@/components/DriverBar";
import { ExampleTabs } from "@/components/ExampleTabs";
import { TryNextWeek } from "@/components/TryNextWeek";
import { LoadingSpinner } from "@/components/LoadingSpinner";
import { DashboardData } from "@/lib/cache";

type Range = "7d" | "30d";

interface DashboardResponse extends DashboardData {
  cached: boolean;
  range: string;
}

interface BackfillingResponse {
  status: "backfilling";
  ingestStatus: string;
  progress: number;
}

export default function DashboardPage() {
  const router = useRouter();
  const [range, setRange] = useState<Range>("30d");
  const [data, setData] = useState<DashboardResponse | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [backfilling, setBackfilling] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchDashboard = async (selectedRange: Range) => {
    try {
      setLoading(true);
      setError(null);

      const res = await fetch(`/api/me/dashboard?range=${selectedRange}`);

      if (res.status === 401) {
        router.push("/");
        return;
      }

      if (res.status === 202) {
        const result: BackfillingResponse = await res.json();
        setBackfilling(true);
        setData(null);
        // Poll again in 3 seconds
        setTimeout(() => fetchDashboard(selectedRange), 3000);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to fetch dashboard");
      }

      const result: DashboardResponse = await res.json();
      setData(result);
      setBackfilling(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const handleRefresh = async () => {
    try {
      setRefreshing(true);
      const res = await fetch("/api/me/refresh", { method: "POST" });

      if (res.status === 429) {
        const result = await res.json();
        alert(result.message);
        return;
      }

      if (!res.ok) {
        throw new Error("Failed to refresh");
      }

      // Show backfilling state and poll
      setBackfilling(true);
      setTimeout(() => fetchDashboard(range), 2000);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Refresh failed");
    } finally {
      setRefreshing(false);
    }
  };

  const handleSignOut = async () => {
    await fetch("/api/auth", { method: "DELETE" });
    router.push("/");
  };

  useEffect(() => {
    fetchDashboard(range);
  }, [range]);

  if (loading && !data && !backfilling) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  if (backfilling) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <LoadingSpinner />
        <h2 className="mt-4 text-lg font-medium text-gray-900 dark:text-white">
          Analyzing your casts...
        </h2>
        <p className="mt-2 text-sm text-gray-500">
          This may take a minute on first load
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-red-500">{error}</p>
        <button
          onClick={() => fetchDashboard(range)}
          className="mt-4 px-4 py-2 bg-purple-600 text-white rounded-lg hover:bg-purple-700"
        >
          Try Again
        </button>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <div className="max-w-md mx-auto p-4 space-y-6">
        {/* Header */}
        <div className="flex justify-between items-center">
          <h1 className="text-xl font-bold text-gray-900 dark:text-white">
            Community Pulse
          </h1>
          <div className="flex items-center gap-2">
            {/* Range selector */}
            <select
              value={range}
              onChange={(e) => setRange(e.target.value as Range)}
              className="px-3 py-1.5 text-sm bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:outline-none focus:ring-2 focus:ring-purple-500"
            >
              <option value="7d">7 days</option>
              <option value="30d">30 days</option>
            </select>

            {/* Refresh button */}
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="p-2 text-gray-500 hover:text-gray-700 dark:hover:text-gray-300 disabled:opacity-50"
              title="Refresh data"
            >
              <svg
                className={`w-5 h-5 ${refreshing ? "animate-spin" : ""}`}
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
            </button>

            {/* Sign out */}
            <button
              onClick={handleSignOut}
              className="text-sm text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            >
              Sign out
            </button>
          </div>
        </div>

        {/* Data Context Summary */}
        {data.dataContext && (
          <div className="bg-white dark:bg-gray-900 rounded-lg px-4 py-3 shadow-sm">
            <p className="text-sm text-gray-600 dark:text-gray-400">
              <span className="font-medium text-gray-900 dark:text-white">
                Analyzing:
              </span>{" "}
              {data.dataContext.totalPosts} posts
              {data.dataContext.rootPosts !== data.dataContext.totalPosts && (
                <span className="text-gray-400 dark:text-gray-500">
                  {" "}({data.dataContext.rootPosts} original, {data.dataContext.totalPosts - data.dataContext.rootPosts} replies)
                </span>
              )}
              {" · "}
              {data.dataContext.repliesReceived} replies received
              {" · "}
              {data.dataContext.uniqueEngagers} engager{data.dataContext.uniqueEngagers !== 1 ? "s" : ""}
            </p>
            {data.dataContext.positivePosts > 0 || data.dataContext.negativePosts > 0 ? (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                Sentiment: {data.dataContext.positivePosts} positive, {data.dataContext.negativePosts} negative, {data.dataContext.totalPosts - data.dataContext.positivePosts - data.dataContext.negativePosts} neutral
              </p>
            ) : (
              <p className="text-xs text-gray-500 dark:text-gray-500 mt-1">
                All posts classified as neutral tone
              </p>
            )}
          </div>
        )}

        {/* Community Outcomes */}
        <section>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
            COMMUNITY
          </h2>
          <div className="grid grid-cols-2 gap-3">
            <MetricCard
              label="New Repliers"
              value={data.activation.value}
              change={data.activation.change}
              tooltip="Unique people who replied to you for the first time"
            />
            <MetricCard
              label="Retention"
              value={`${data.retention.value}%`}
              change={data.retention.change}
              tooltip="% of last period's repliers who came back"
            />
            <MetricCard
              label="Avg Depth"
              value={data.conversationDepth.avgReplies}
              subtitle="replies"
              tooltip="Average replies on your root casts"
            />
            <MetricCard
              label="Reciprocity"
              value={`${data.reciprocity.replyBackRate}%`}
              subtitle={`${data.reciprocity.mutualDyads} mutual`}
              tooltip="How often you reply back to your repliers"
            />
          </div>
        </section>

        {/* Tone Drivers */}
        <section>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
            TONE
          </h2>
          <div className="bg-white dark:bg-gray-900 rounded-xl p-4 space-y-4 shadow-sm">
            <DriverBar
              label="Positive"
              value={data.positiveRate.value}
              max={100}
              suffix="%"
              color="green"
            />
            <DriverBar
              label="Rage"
              value={data.rageDensity.value}
              max={100}
              suffix="/1k"
              color="red"
              warning={data.rageDensity.value > 50}
            />
            <DriverBar
              label="Agency"
              value={data.agencyRate.value}
              max={100}
              suffix="%"
              color="purple"
            />
          </div>
        </section>

        {/* Examples */}
        <section>
          <h2 className="text-sm font-medium text-gray-500 dark:text-gray-400 mb-3">
            EXAMPLES
          </h2>
          <ExampleTabs
            rage={data.topExamples.rage}
            agency={data.topExamples.agency}
          />
        </section>

        {/* Try This Next Week */}
        <TryNextWeek metrics={data} />

        {/* Disclaimer */}
        <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-3">
          <p className="text-xs text-yellow-800 dark:text-yellow-200">
            <strong>Note:</strong> These metrics show patterns in your content —
            they suggest correlations, not causes. Emotional classification is
            automated and may miss nuance or sarcasm.
          </p>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-gray-400 pb-4">
          {data.cached && <span>Cached • </span>}
          <span>Community Pulse v2</span>
        </div>
      </div>
    </div>
  );
}
