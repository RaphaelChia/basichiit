"use client"

import * as React from "react"
import { cn } from "@/lib/utils"

interface NextUpLabelProps {
  label: string;
  position?: "top-right" | "top-left" | "bottom-right" | "bottom-left";
  className?: string;
}

export function NextUpLabel({
  label,
  position = "top-right",
  className,
}: NextUpLabelProps) {
  const positionClasses = {
    "top-right": "top-4 right-4",
    "top-left": "top-4 left-4",
    "bottom-right": "bottom-4 right-4",
    "bottom-left": "bottom-4 left-4",
  }

  return (
    <div
      className={cn(
        "absolute px-3 py-1.5 rounded-lg bg-card/90 backdrop-blur-sm border border-border text-sm font-medium text-card-foreground",
        positionClasses[position],
        className
      )}
    >
      Next: {label}
    </div>
  )
}

