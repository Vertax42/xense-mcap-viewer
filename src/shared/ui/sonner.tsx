import * as React from "react"
import { Toaster as Sonner, type ToasterProps } from "sonner"

import { cn } from "@/shared/lib/utils"

const toastClassNames: NonNullable<NonNullable<ToasterProps["toastOptions"]>["classNames"]> = {
  toast:
    "group toast group-[.toaster]:bg-background group-[.toaster]:text-foreground group-[.toaster]:border-border group-[.toaster]:shadow-lg",
  description: "group-[.toast]:text-muted-foreground",
  actionButton:
    "group-[.toast]:bg-primary group-[.toast]:text-primary-foreground",
  cancelButton:
    "group-[.toast]:bg-muted group-[.toast]:text-muted-foreground",
}

export const Toaster = React.forwardRef<HTMLElement, ToasterProps>(
  ({ className, toastOptions, ...props }, ref) => (
    <Sonner
      ref={ref}
      className={cn("toaster group", className)}
      toastOptions={{
        ...toastOptions,
        classNames: {
          ...toastClassNames,
          ...toastOptions?.classNames,
        },
      }}
      {...props}
    />
  ),
)
Toaster.displayName = "Toaster"
