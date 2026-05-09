import Link from "next/link";
import { Compass, ArrowRight } from "lucide-react";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-background p-6">
      <div className="text-center max-w-sm space-y-4">
        <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10">
          <Compass className="h-5 w-5 text-primary" />
        </div>
        <div className="space-y-1">
          <h1 className="text-2xl font-semibold tracking-tight">404</h1>
          <p className="text-sm text-muted-foreground">
            That page doesn't exist or you don't have access.
          </p>
        </div>
        <Link
          href="/"
          className="inline-flex items-center gap-1 text-sm font-medium text-primary hover:underline"
        >
          Back to dashboard <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </div>
  );
}
