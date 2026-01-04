import type { Metadata } from "next";
import "./globals.css";
import { MiniAppProvider } from "@/components/MiniAppProvider";

export const metadata: Metadata = {
  title: "Community Pulse",
  description: "Track your community-building metrics on Farcaster",
  openGraph: {
    title: "Community Pulse",
    description: "Track your community-building metrics on Farcaster",
    type: "website",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="min-h-screen bg-gray-50 dark:bg-gray-950">
        <MiniAppProvider>{children}</MiniAppProvider>
      </body>
    </html>
  );
}
