import type { Metadata } from "next";
import "./globals.css";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryProvider } from "@/components/providers/query-provider";

export const metadata: Metadata = {
  title: "Compass ERP",
  description: "Internal operating system for Compass Marketing Kft.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="hu" className="h-full">
      <body className="h-full bg-background text-foreground">
        <QueryProvider>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        </QueryProvider>
      </body>
    </html>
  );
}
