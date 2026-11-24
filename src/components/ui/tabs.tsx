"use client";

import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { cn } from "@/lib/utils";

export const Tabs = TabsPrimitive.Root;

export function TabsList({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>) {
  return (
    <TabsPrimitive.List
      className={cn(
        "inline-flex min-h-11 items-center gap-1 rounded-md border border-border-subtle bg-surface-secondary p-1 text-text-secondary",
        className
      )}
      {...props}
    />
  );
}

export function TabsTrigger({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>) {
  return (
    <TabsPrimitive.Trigger
      className={cn(
        "inline-flex min-h-11 items-center justify-center gap-2 rounded-sm px-4 py-2 text-sm font-medium text-text-secondary transition-opacity duration-150 hover:text-text-primary data-[state=active]:bg-surface-primary data-[state=active]:text-text-primary data-[state=active]:border data-[state=active]:border-border-subtle focus-visible:outline-2 focus-visible:outline-focus-ring cursor-pointer",
        className
      )}
      {...props}
    />
  );
}

export function TabsContent({
  className,
  ...props
}: React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>) {
  return (
    <TabsPrimitive.Content
      className={cn("flex flex-col gap-4 focus-visible:outline-none", className)}
      {...props}
    />
  );
}
