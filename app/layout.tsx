import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: "Compass ERP",
  description: "Internal operating system for Compass Marketing Kft.",
  // The ERP now shares a domain with the public marketing site. Keep every
  // app route out of the index so it never competes with or leaks into it.
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className="h-full">
      <head>
        {/* Same Google Fonts request the marketing site makes, so the two
            share a browser cache entry and render identically. Host Grotesk
            is not in next/font's list on Next 14, hence the link tag. */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Host+Grotesk:wght@300;400;500;600;700&family=Space+Mono:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="h-full bg-background text-foreground">
        <QueryProvider>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
