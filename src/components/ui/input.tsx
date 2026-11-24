import * as React from "react";
import { cn } from "@/lib/utils";

export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  hasError?: boolean;
}

export const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, type = "text", hasError = false, ...props }, ref) => {
    return (
      <input
        ref={ref}
        type={type}
        aria-invalid={hasError || undefined}
        className={cn(
          "flex min-h-10 w-full rounded-xl border bg-surface-primary px-3.5 py-2 text-sm text-text-primary placeholder:text-text-muted shadow-[0_1px_2px_rgba(15,23,42,0.02)] transition-all duration-150 focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-focus-ring disabled:cursor-not-allowed disabled:opacity-50",
          hasError ? "border-status-danger-border" : "border-border-subtle hover:border-border-strong",
          className
        )}
        {...props}
      />
    );
  }
);
Input.displayName = "Input";
