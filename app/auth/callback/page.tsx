"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Suspense } from "react";

function CallbackContent() {
  const searchParams = useSearchParams();
  const [status, setStatus] = useState("Processing...");

  useEffect(() => {
    // Debug: log all params
    const allParams: Record<string, string> = {};
    searchParams.forEach((value, key) => {
      allParams[key] = value;
    });
    console.log("Callback params:", allParams);
    console.log("URL hash:", window.location.hash);

    // Neynar SIWN sends: fid, signer_uuid, is_authenticated, etc.
    const fid = searchParams.get("fid");
    const signerUuid = searchParams.get("signer_uuid");
    const isAuthenticated = searchParams.get("is_authenticated");

    // Also check for user info that might be passed
    const username = searchParams.get("username");
    const displayName = searchParams.get("display_name");
    const pfpUrl = searchParams.get("pfp_url");

    console.log("fid:", fid, "isAuthenticated:", isAuthenticated);

    if (fid && window.opener) {
      setStatus("Signing in...");

      // Send data back to parent window
      window.opener.onSignInSuccess?.({
        fid: parseInt(fid),
        signer_uuid: signerUuid || "",
        username: username || "",
        display_name: displayName || "",
        pfp_url: pfpUrl || "",
      });

      // Close popup
      setTimeout(() => window.close(), 500);
    } else if (!fid) {
      setStatus("No user data received. Check console for params.");
    } else if (!window.opener) {
      setStatus("Popup context lost. Please try again.");
    }
  }, [searchParams]);

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto" />
        <p className="mt-4 text-gray-600">{status}</p>
        <p className="mt-2 text-xs text-gray-400">
          Check browser console for debug info
        </p>
      </div>
    </div>
  );
}

export default function AuthCallback() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600" />
        </div>
      }
    >
      <CallbackContent />
    </Suspense>
  );
}
