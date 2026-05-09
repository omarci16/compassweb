"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { SOURCE_LABELS, PACKAGE_LABELS } from "@/lib/types/app.types";

interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
}

export function QuickAddLead({ open, onOpenChange }: Props) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setLoading(true);
    setError(null);
    const fd = new FormData(e.currentTarget);
    const payload = {
      company_name: fd.get("company_name"),
      contact_name: fd.get("contact_name") || null,
      email: fd.get("email"),
      phone: fd.get("phone") || null,
      website_url: fd.get("website_url") || null,
      source: fd.get("source"),
      niche: fd.get("niche") || null,
      package_interest: fd.get("package_interest") || null,
      budget_confirmed: fd.get("budget_confirmed") === "on",
      decision_maker_confirmed: fd.get("decision_maker_confirmed") === "on",
      timeline_weeks: fd.get("timeline_weeks") ? Number(fd.get("timeline_weeks")) : null,
      internal_notes: fd.get("internal_notes") || null,
    };
    try {
      const res = await fetch("/api/leads", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!res.ok) {
        const j = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(j.error || "Failed to create lead");
      }
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>New lead</DialogTitle>
          <DialogDescription>
            Quick capture — enrichment + AI scoring kick off automatically.
          </DialogDescription>
        </DialogHeader>
        <form onSubmit={onSubmit} className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Field label="Company name" required>
              <Input name="company_name" required />
            </Field>
            <Field label="Contact name">
              <Input name="contact_name" />
            </Field>
            <Field label="Email" required>
              <Input name="email" type="email" required />
            </Field>
            <Field label="Phone">
              <Input name="phone" />
            </Field>
            <Field label="Website URL">
              <Input name="website_url" type="url" placeholder="https://" />
            </Field>
            <Field label="Niche">
              <Input name="niche" placeholder="restaurant, dentist..." />
            </Field>
            <Field label="Source" required>
              <Select name="source" defaultValue="referral">
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  {Object.entries(SOURCE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Package interest">
              <Select name="package_interest" defaultValue="">
                <SelectTrigger><SelectValue placeholder="Unknown" /></SelectTrigger>
                <SelectContent>
                  {Object.entries(PACKAGE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Timeline (weeks)">
              <Input name="timeline_weeks" type="number" min={1} />
            </Field>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2">
              <span className="text-xs font-medium">Budget confirmed</span>
              <Switch name="budget_confirmed" />
            </div>
            <div className="flex items-center justify-between rounded-lg border border-border px-3 py-2 col-span-2">
              <span className="text-xs font-medium">Decision-maker confirmed</span>
              <Switch name="decision_maker_confirmed" />
            </div>
          </div>
          <Field label="Internal notes">
            <Textarea name="internal_notes" rows={2} />
          </Field>
          {error && (
            <div className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive">
              {error}
            </div>
          )}
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
            >
              Cancel
            </Button>
            <Button type="submit" disabled={loading}>
              {loading && <Loader2 className="h-4 w-4 animate-spin" />}
              Create lead
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function Field({
  label,
  required,
  children,
}: {
  label: string;
  required?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1.5">
      <Label>
        {label}
        {required && <span className="text-destructive ml-0.5">*</span>}
      </Label>
      {children}
    </div>
  );
}
