"use client";

import { useEffect, useState } from "react";
import { useMiniApp } from "@/components/MiniAppProvider";
import { Dashboard } from "@/components/Dashboard";
import { LoadingSpinner } from "@/components/LoadingSpinner";

export default function Home() {
  const { user, isLoaded, isInMiniApp, ensureUser, error } = useMiniApp();
  const [isInitialized, setIsInitialized] = useState(false);
  const [initError, setInitError] = useState<string | null>(null);

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

  // Still loading SDK
  if (!isLoaded) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <LoadingSpinner />
      </div>
    );
  }

  // Not in a Mini App context - show instructions
  if (!isInMiniApp) {
    return (
      <main className="min-h-screen flex flex-col items-center justify-center p-6">
        <div className="max-w-md w-full space-y-6 text-center">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Community Pulse
          </h1>
          <p className="text-gray-600 dark:text-gray-400">
            Track your community-building metrics on Farcaster
          </p>

          <div className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-6">
            <p className="text-sm text-purple-800 dark:text-purple-200">
              This is a Farcaster Mini App. Open it in Warpcast to use it.
            </p>
          </div>

          <div className="space-y-3 text-left bg-white dark:bg-gray-900 rounded-xl p-6 shadow-sm">
            <h3 className="font-medium text-gray-900 dark:text-white">
              How to open:
            </h3>
            <ol className="text-sm text-gray-600 dark:text-gray-400 space-y-2 list-decimal list-inside">
              <li>Open Warpcast on your phone</li>
              <li>Search for &quot;Community Pulse&quot; in Mini Apps</li>
              <li>Or share this link in a cast and tap it</li>
            </ol>
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
