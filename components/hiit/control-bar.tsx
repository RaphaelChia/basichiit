"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Play, Pause, RotateCcw, SkipForward } from "lucide-react";
import { cn } from "@/lib/utils";

interface ControlBarProps {
  isPaused: boolean;
  onPlay: () => void;
  onPause: () => void;
  onRestart: () => void;
  onSkipSet: () => void;
  className?: string;
}

export function ControlBar({
  isPaused,
  onPlay,
  onPause,
  onRestart,
  onSkipSet,
  className,
}: ControlBarProps) {
  return (
    <div className={cn("flex items-center justify-center gap-3", className)}>
      <Button
        variant="outline"
        size="icon"
        onClick={onRestart}
        aria-label="Restart"
        className="h-12 w-12"
      >
        <RotateCcw className="h-5 w-5" />
      </Button>
      <Button
        variant="default"
        size="icon"
        onClick={isPaused ? onPlay : onPause}
        aria-label={isPaused ? "Play" : "Pause"}
        className="h-14 w-14"
      >
        {isPaused ? (
          <Play className="h-6 w-6" />
        ) : (
          <Pause className="h-6 w-6" />
        )}
      </Button>
      <Button
        variant="outline"
        size="icon"
        onClick={onSkipSet}
        aria-label="Skip Set"
        className="h-12 w-12"
      >
        <SkipForward className="h-5 w-5" />
      </Button>
    </div>
  );
}
