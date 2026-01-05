"use client";

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  ReactNode,
} from "react";
import { sdk } from "@farcaster/miniapp-sdk";

interface MiniAppUser {
  fid: number;
  username?: string;
  displayName?: string;
  pfpUrl?: string;
}

interface MiniAppContextType {
  user: MiniAppUser | null;
  isLoaded: boolean;
  isInMiniApp: boolean;
  error: string | null;
  ensureUser: () => Promise<MiniAppUser | null>;
}

const MiniAppContext = createContext<MiniAppContextType>({
  user: null,
  isLoaded: false,
  isInMiniApp: false,
  error: null,
  ensureUser: async () => null,
});

export function useMiniApp() {
  return useContext(MiniAppContext);
}

export function MiniAppProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MiniAppUser | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);
  const [isInMiniApp, setIsInMiniApp] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const init = async () => {
      try {
        // Get context from the Mini App SDK
        const context = await sdk.context;

        if (context?.user) {
          console.log("[MiniApp] User from SDK:", context.user.fid, context.user.username);
          setUser({
            fid: context.user.fid,
            username: context.user.username,
            displayName: context.user.displayName,
            pfpUrl: context.user.pfpUrl,
          });
          setIsInMiniApp(true);

          // Tell the host we're ready (hides splash screen)
          sdk.actions.ready();
        } else {
          // Not in a mini app context - might be direct browser access
          setIsInMiniApp(false);
        }
      } catch (e) {
        console.log("Mini App SDK init:", e);
        setIsInMiniApp(false);
        // Don't set error - just means we're not in a mini app
      } finally {
        setIsLoaded(true);
      }
    };

    init();
  }, []);

  // Function to register user with our backend
  const ensureUser = useCallback(async (): Promise<MiniAppUser | null> => {
    if (!user) return null;

    try {
      // Register/update user in our database
      const res = await fetch("/api/auth/miniapp", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          fid: user.fid,
          username: user.username,
          displayName: user.displayName,
          pfpUrl: user.pfpUrl,
        }),
      });

      if (!res.ok) {
        throw new Error("Failed to register user");
      }

      return user;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to initialize");
      return null;
    }
  }, [user]);

  return (
    <MiniAppContext.Provider
      value={{ user, isLoaded, isInMiniApp, error, ensureUser }}
    >
      {children}
    </MiniAppContext.Provider>
  );
}
