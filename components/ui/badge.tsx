import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center rounded border px-2 py-0.5 font-mono text-[11px] font-normal tracking-[0.06em] transition-colors",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground",
        secondary: "border-transparent bg-secondary text-secondary-foreground",
        outline: "border-border-light text-muted-foreground",
        success: "border-transparent bg-compass-green/15 text-compass-green",
        warning: "border-transparent bg-compass-amber/15 text-compass-amber",
        destructive: "border-transparent bg-compass-red/15 text-compass-red",
        info: "border-transparent bg-compass-blue/15 text-compass-blue",
        purple: "border-transparent bg-compass-purple/15 text-compass-purple",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, ...props }: BadgeProps) {
  return <div className={cn(badgeVariants({ variant }), className)} {...props} />;
}

export { Badge, badgeVariants };
