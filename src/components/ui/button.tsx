import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg" | "icon";
  asChild?: boolean;
  isLoading?: boolean;
}

const variantClasses: Record<NonNullable<ButtonProps["variant"]>, string> = {
  primary:
    "bg-action-primary-bg text-action-primary-fg hover:bg-action-primary-hover border border-transparent shadow-[0_4px_14px_rgba(17,24,39,0.16)]",
  secondary:
    "bg-action-secondary-bg text-action-secondary-fg hover:bg-action-secondary-hover border border-border-subtle",
  outline:
    "bg-surface-primary text-text-primary hover:bg-surface-secondary border border-border-strong/80 shadow-[0_1px_3px_rgba(15,23,42,0.03)]",
  ghost:
    "bg-transparent text-text-secondary hover:bg-surface-tertiary/70 hover:text-text-primary border border-transparent",
  danger:
    "bg-status-danger-bg text-status-danger-fg hover:opacity-90 border border-status-danger-border",
};

const sizeClasses: Record<NonNullable<ButtonProps["size"]>, string> = {
  sm: "min-h-9 px-3.5 py-1.5 text-xs rounded-full",
  md: "min-h-10 px-5 py-2 text-sm rounded-full",
  lg: "min-h-12 px-6 py-3 text-base rounded-full",
  icon: "min-h-9 min-w-9 p-2 rounded-full",
};

export function Button({
  className,
  variant = "primary",
  size = "md",
  asChild = false,
  isLoading = false,
  disabled,
  children,
  type = "button",
  ...props
}: ButtonProps) {
  const Comp = asChild ? Slot : "button";
  return (
    <Comp
      type={asChild ? undefined : type}
      disabled={disabled || isLoading}
      aria-busy={isLoading || undefined}
      className={cn(
        "inline-flex items-center justify-center gap-2 font-semibold transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-focus-ring disabled:pointer-events-none disabled:opacity-50 cursor-pointer select-none",
        variantClasses[variant],
        sizeClasses[size],
        className
      )}
      {...props}
    >
      {children}
    </Comp>
  );
}
