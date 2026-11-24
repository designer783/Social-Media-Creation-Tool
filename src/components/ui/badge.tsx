import * as React from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: "neutral" | "success" | "warning" | "danger" | "info";
}

const badgeVariantClasses: Record<NonNullable<BadgeProps["variant"]>, string> = {
  neutral: "bg-surface-tertiary text-text-secondary border-border-subtle",
  success: "bg-status-success-bg text-status-success-fg border-status-success-border",
  warning: "bg-status-warning-bg text-status-warning-fg border-status-warning-border",
  danger: "bg-status-danger-bg text-status-danger-fg border-status-danger-border",
  info: "bg-status-info-bg text-status-info-fg border-status-info-border",
};

export function Badge({ className, variant = "neutral", ...props }: BadgeProps) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold",
        badgeVariantClasses[variant],
        className
      )}
      {...props}
    />
  );
}
