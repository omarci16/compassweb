"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { InvoiceStatus } from "@/lib/types/app.types";

export function MarkPaidButton({
  invoiceId,
  status,
  size = "sm",
}: {
  invoiceId: string;
  status: InvoiceStatus;
  size?: "sm" | "default";
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);

  if (status === "paid" || status === "cancelled") return null;

  async function markPaid() {
    setLoading(true);
    try {
      await fetch(`/api/invoices/${invoiceId}`, {
        method: "PATCH",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ status: "paid" }),
      });
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <Button
      size={size}
      variant="outline"
      onClick={markPaid}
      disabled={loading}
      className="gap-1.5"
    >
      {loading ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Check className="h-3.5 w-3.5" />
      )}
      Mark paid
    </Button>
  );
}
