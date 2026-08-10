import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "YieldBoard — the rate you actually keep",
  description: "Curated DeFi and RWA yields. Realized rates, multi-venue loops, Pendle fixed, rate arb. Refreshed every 2 hours.",
};

const FONTS = "https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&family=Unbounded:wght@700;800&display=swap";

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link rel="stylesheet" href={FONTS} />
      </head>
      <body>{children}</body>
    </html>
  );
}
