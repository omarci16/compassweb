"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { ExternalLink, Globe, Loader2, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export function VisualDropZone({
  dealId,
  initialUrl,
}: {
  dealId: string;
  initialUrl: string | null;
}) {
  const router = useRouter();
  const [url, setUrl] = useState(initialUrl ?? "");
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);

  async function attach(value: string) {
    if (!value) return;
    setLoading(true);
    try {
      await fetch(`/api/deals/${dealId}/attach-visual`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ url: value }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-3">
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragOver(false);
          const dropped = e.dataTransfer.getData("text/plain") || e.dataTransfer.getData("text/uri-list");
          if (dropped) {
            setUrl(dropped);
            void attach(dropped);
          }
        }}
        className={cn(
          "rounded-xl border-2 border-dashed border-border bg-muted/30 p-6 transition-colors text-center",
          dragOver && "border-primary bg-primary/5",
        )}
      >
        <Upload className="h-5 w-5 mx-auto text-muted-foreground" />
        <p className="text-sm font-medium mt-2">Drop a Vercel preview URL here</p>
        <p className="text-xs text-muted-foreground mt-0.5">or paste it below</p>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="https://your-preview.vercel.app"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <Button onClick={() => attach(url)} disabled={!url || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Attach"}
        </Button>
      </div>

      {initialUrl && (
        <div className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center justify-between px-3 py-2 border-b border-border bg-muted/40">
            <div className="flex items-center gap-1.5 text-xs">
              <Globe className="h-3 w-3 text-compass-blue" />
              <span className="font-mono truncate">{initialUrl}</span>
            </div>
            <a
              href={initialUrl}
              target="_blank"
              rel="noreferrer"
              className="text-xs text-primary hover:underline inline-flex items-center gap-1"
            >
              Open <ExternalLink className="h-3 w-3" />
            </a>
          </div>
          <iframe
            src={initialUrl}
            title="Visual preview"
            className="w-full h-72 bg-background"
            sandbox="allow-same-origin allow-scripts"
          />
        </div>
      )}
    </div>
  );
}
