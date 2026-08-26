"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Copy, Loader2, RefreshCw, ExternalLink, Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function PortalTokenManager({
  projectId,
  token,
}: {
  projectId: string;
  token: string;
}) {
  const router = useRouter();
  const [confirming, setConfirming] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  const portalPath = `/portal/${token}`;
  const fullUrl =
    typeof window !== "undefined" ? `${window.location.origin}${portalPath}` : portalPath;

  async function copyLink() {
    await navigator.clipboard.writeText(fullUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function regenerate() {
    setBusy(true);
    try {
      await fetch(`/api/projects/${projectId}/regenerate-token`, { method: "POST" });
      router.refresh();
      setConfirming(false);
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <div className="flex flex-wrap gap-2">
        <Button asChild variant="outline" size="sm" className="gap-1.5">
          <a href={portalPath} target="_blank" rel="noreferrer">
            <Eye className="h-3.5 w-3.5" />
            Open portal
            <ExternalLink className="h-3 w-3" />
          </a>
        </Button>
        <Button variant="outline" size="sm" onClick={copyLink} className="gap-1.5">
          <Copy className="h-3.5 w-3.5" />
          {copied ? "Copied" : "Copy link"}
        </Button>
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setConfirming(true)}
          className="gap-1.5 text-muted-foreground"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Regenerate
        </Button>
      </div>

      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Regenerate portal link?</DialogTitle>
            <DialogDescription>
              The current link will stop working immediately. You'll need to send the new link to the client.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setConfirming(false)} disabled={busy}>
              Cancel
            </Button>
            <Button onClick={regenerate} disabled={busy} className="gap-1.5">
              {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
              Regenerate
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
