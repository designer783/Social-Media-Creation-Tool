"use client";

import * as React from "react";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

export const Dialog = DialogPrimitive.Root;
export const DialogTrigger = DialogPrimitive.Trigger;
export const DialogClose = DialogPrimitive.Close;

export function DialogContent({
  className,
  children,
  title,
  description,
  ...props
}: React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content> & {
  title: string;
  description?: string;
}) {
  return (
    <DialogPrimitive.Portal>
      <DialogPrimitive.Overlay className="fixed inset-0 z-30 bg-surface-inverse/50 backdrop-blur-xs transition-opacity duration-150" />
      <DialogPrimitive.Content
        className={cn(
          "fixed left-1/2 top-1/2 z-30 flex w-full max-w-2xl -translate-x-1/2 -translate-y-1/2 flex-col gap-6 rounded-3xl border border-border-subtle bg-surface-primary p-6 text-text-primary shadow-[0_24px_60px_rgba(15,23,42,0.16)] focus-visible:outline-2 focus-visible:outline-focus-ring max-h-[90dvh] overflow-y-auto",
          className
        )}
        {...props}
      >
        <div className="flex items-start justify-between gap-4 border-b border-border-subtle pb-4">
          <div className="flex flex-col gap-1">
            <DialogPrimitive.Title className="text-lg font-semibold text-text-primary">
              {title}
            </DialogPrimitive.Title>
            {description ? (
              <DialogPrimitive.Description className="text-sm text-text-secondary">
                {description}
              </DialogPrimitive.Description>
            ) : null}
          </div>
          <DialogPrimitive.Close
            aria-label="Close dialog"
            className="inline-flex min-h-11 min-w-11 items-center justify-center rounded-md text-text-secondary hover:bg-surface-tertiary hover:text-text-primary focus-visible:outline-2 focus-visible:outline-focus-ring cursor-pointer"
          >
            <X className="h-5 w-5" aria-hidden="true" />
          </DialogPrimitive.Close>
        </div>
        {children}
      </DialogPrimitive.Content>
    </DialogPrimitive.Portal>
  );
}
