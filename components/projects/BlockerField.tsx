"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { AlertOctagon, Loader2, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

export function BlockerField({
  projectId,
  initial,
}: {
  projectId: string;
  initial: string | null;
}) {
  const router = useRouter();
  const [value, setValue] = useState(initial ?? "");
  const [loading, setLoading] = useState(false);

  async function save(next: string | null) {
    setLoading(true);
    try {
      await fetch(`/api/projects/${projectId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          blocker: next,
          blocker_set_at: next ? new Date().toISOString() : null,
        }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  if (!initial) {
    return (
      <div className="flex gap-2">
        <Input
          placeholder="What is blocking this project?"
          value={value}
          onChange={(e) => setValue(e.target.value)}
        />
        <Button onClick={() => save(value)} disabled={!value || loading}>
          {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Set blocker"}
        </Button>
      </div>
    );
  }

  return (
    <div className="rounded-lg border border-compass-red/30 bg-compass-red/5 p-3">
      <div className="flex items-start gap-2">
        <AlertOctagon className="h-4 w-4 text-compass-red mt-0.5 shrink-0" />
        <div className="flex-1">
          <div className="text-xs uppercase tracking-wide text-compass-red font-semibold">
            Blocked
          </div>
          <p className="text-sm text-foreground mt-0.5">{initial}</p>
        </div>
        <Button
          size="icon"
          variant="ghost"
          onClick={() => {
            setValue("");
            void save(null);
          }}
          disabled={loading}
          className="h-7 w-7"
        >
          <X className="h-3.5 w-3.5" />
        </Button>
      </div>
    </div>
  );
}
