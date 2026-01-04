"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";

declare global {
  interface Window {
    onSignInSuccess?: (data: SignInData) => void;
  }
}

interface SignInData {
  signer_uuid: string;
  fid: number;
  username: string;
  display_name: string;
  pfp_url: string;
}

export function SignInButton() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // Handle callback from Neynar
    window.onSignInSuccess = async (data: SignInData) => {
      setLoading(true);
      setError(null);

      try {
        const res = await fetch("/api/auth", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(data),
        });

        if (!res.ok) {
          throw new Error("Authentication failed");
        }

        router.push("/dashboard");
      } catch (err) {
        setError(err instanceof Error ? err.message : "Sign in failed");
        setLoading(false);
      }
    };

    return () => {
      delete window.onSignInSuccess;
    };
  }, [router]);

  const handleSignIn = () => {
    const clientId = process.env.NEXT_PUBLIC_NEYNAR_CLIENT_ID;
    if (!clientId) {
      setError("Neynar client ID not configured");
      return;
    }

    // Open Neynar SIWF popup
    const width = 500;
    const height = 600;
    const left = window.screenX + (window.outerWidth - width) / 2;
    const top = window.screenY + (window.outerHeight - height) / 2;

    const redirectUri = encodeURIComponent(
      `${window.location.origin}/auth/callback`
    );

    const url = `https://app.neynar.com/login?client_id=${clientId}&redirect_uri=${redirectUri}`;

    window.open(
      url,
      "neynar-signin",
      `width=${width},height=${height},left=${left},top=${top}`
    );
  };

  return (
    <div className="space-y-3">
      <button
        onClick={handleSignIn}
        disabled={loading}
        className="w-full flex items-center justify-center gap-2 px-6 py-3 bg-purple-600 hover:bg-purple-700 disabled:opacity-50 text-white font-medium rounded-xl transition-colors"
      >
        {loading ? (
          <>
            <svg
              className="animate-spin h-5 w-5"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
              />
            </svg>
            Signing in...
          </>
        ) : (
          <>
            <FarcasterIcon />
            Sign in with Farcaster
          </>
        )}
      </button>

      {error && <p className="text-sm text-red-500 text-center">{error}</p>}
    </div>
  );
}

function FarcasterIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 1000 1000"
      fill="currentColor"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M257.778 155.556H742.222V844.444H671.111V528.889H670.414C662.554 441.677 589.258 373.333 500 373.333C410.742 373.333 337.446 441.677 329.586 528.889H328.889V844.444H257.778V155.556Z" />
      <path d="M128.889 253.333L157.778 351.111H182.222V746.667C169.949 746.667 160 756.616 160 768.889V795.556H155.556C143.283 795.556 133.333 805.505 133.333 817.778V844.444H382.222V817.778C382.222 805.505 372.273 795.556 360 795.556H355.556V768.889C355.556 756.616 345.606 746.667 333.333 746.667H306.667V253.333H128.889Z" />
      <path d="M675.556 746.667C663.283 746.667 653.333 756.616 653.333 768.889V795.556H648.889C636.616 795.556 626.667 805.505 626.667 817.778V844.444H875.556V817.778C875.556 805.505 865.606 795.556 853.333 795.556H848.889V768.889C848.889 756.616 838.94 746.667 826.667 746.667V351.111H851.111L880 253.333H702.222V746.667H675.556Z" />
    </svg>
  );
}
