"use client";

import { useEffect, useState } from "react";
import { useMiniApp } from "@/components/MiniAppProvider";
import { Dashboard } from "@/components/Dashboard";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function Home() {
  const { user, isLoaded, isInMiniApp, ensureUser, error } = useMiniApp();
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

  // Lookup state for non-mini-app mode
  const [lookupInput, setLookupInput] = useState("");
  const [lookupFid, setLookupFid] = useState<number | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupError, setLookupError] = useState<string | null>(null);
  const [postLimit, setPostLimit] = useState<number>(100);
  const [forceRefresh, setForceRefresh] = useState(false);

  useEffect(() => {
    const init = async () => {
      if (isLoaded && user) {
        try {
          await ensureUser();
          setIsInitialized(true);
        } catch (e) {
          setInitError(e instanceof Error ? e.message : "Failed to initialize");
        }
      }
    };

    init();
  }, [isLoaded, user, ensureUser]);

  const handleLookup = async (e: React.FormEvent) => {
    e.preventDefault();
    setLookupError(null);
    setLookupLoading(true);

    try {
      const input = lookupInput.trim();

      const forceParam = forceRefresh ? "&force=true" : "";

      // Check if it's a number (FID)
      if (/^\d+$/.test(input)) {
        const fid = parseInt(input, 10);
        // Trigger ingestion for this FID
        await fetch(`/api/lookup?fid=${fid}&limit=${postLimit}${forceParam}`, { method: "POST" });
        setLookupFid(fid);
      } else {
        // It's a username - look up the FID
        const res = await fetch(`/api/lookup?username=${encodeURIComponent(input)}&limit=${postLimit}${forceParam}`, { method: "POST" });
        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "User not found");
        }

        setLookupFid(data.fid);
      }
    } catch (err) {
      setLookupError(err instanceof Error ? err.message : "Lookup failed");
    } finally {
      setLookupLoading(false);
    }
  };

  // Still loading SDK
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Not in a Mini App context - show lookup form
  if (!isInMiniApp) {
    // If we have a looked-up FID, show their dashboard
    if (lookupFid) {
      return (
        <div>
          <div className="bg-purple-100 dark:bg-purple-900/30 px-4 py-2 text-center">
            <span className="text-sm text-purple-800 dark:text-purple-200">
              Viewing FID: {lookupFid}
            </span>
            <button
              onClick={() => setLookupFid(null)}
              className="ml-3 text-sm text-purple-600 dark:text-purple-400 underline"
            >
              Look up another
            </button>
          </div>
          <Dashboard fid={lookupFid} />
        </div>
      );
    }

    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Community Pulse
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track community-building metrics on Farcaster
          </p>

          <form onSubmit={handleLookup} className="space-y-3">
            <input
              type="text"
              value={lookupInput}
              onChange={(e) => setLookupInput(e.target.value)}
              placeholder="Enter FID or username (e.g. 218775 or vitalik.eth)"
              className="w-full px-4 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
            />
            <div className="flex gap-2">
              <select
                value={postLimit}
                onChange={(e) => setPostLimit(Number(e.target.value))}
                className="px-3 py-3 border border-gray-300 dark:border-gray-700 rounded-xl bg-white dark:bg-gray-900 text-gray-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-purple-500"
              >
                <option value={50}>50 posts</option>
                <option value={100}>100 posts</option>
                <option value={250}>250 posts</option>
                <option value={500}>500 posts</option>
              </select>
              <button
                type="submit"
                disabled={lookupLoading || !lookupInput.trim()}
                className="flex-1 px-4 py-3 bg-purple-600 text-white rounded-xl font-medium hover:bg-purple-700 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {lookupLoading ? "Loading..." : "View Analytics"}
              </button>
            </div>
            <label className="flex items-center gap-2 text-sm text-gray-600 dark:text-gray-400">
              <input
                type="checkbox"
                checked={forceRefresh}
                onChange={(e) => setForceRefresh(e.target.checked)}
                className="rounded border-gray-300 dark:border-gray-700"
              />
              Force re-fetch data (use if data looks stale)
            </label>
          </form>

          {lookupError && (
            <p className="text-red-500 text-sm">{lookupError}</p>
          )}

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
            <p className="text-sm text-purple-800 dark:text-purple-200">
              Or open in the Farcaster app for the full experience
            </p>
          </div>

          <p className="text-xs text-gray-400">
            Built for the Farcaster community
          </p>
        </div>
      </main>
    );
  }

  // Error state
  if (error || initError) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <p className="text-red-500">{error || initError}</p>
      </div>
    );
  }

  // Waiting for user initialization
  if (!isInitialized) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center p-6">
        <LoadingSpinner />
        <p className="mt-4 text-gray-600 dark:text-gray-400">
          Loading your data...
        </p>
      </div>
    );
  }

  // Show dashboard
  return <Dashboard fid={user!.fid} />;
}
