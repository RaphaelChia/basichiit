"use client"

import * as React from "react"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Button } from "@/components/ui/button"
import { CircularProgress } from "./circular-progress"
import { NextUpLabel } from "./next-up-label"
import { ControlBar } from "./control-bar"
import { HIITConfig, TimerPhase, TimerState, PhaseInfo } from "@/lib/hiit-types"
import { cn } from "@/lib/utils"

// TypeScript types for Wake Lock API
interface WakeLockSentinel extends EventTarget {
  released: boolean
  type: 'screen'
  release(): Promise<void>
}

interface Navigator {
  wakeLock?: {
    request(type: 'screen'): Promise<WakeLockSentinel>
  }
}

const MIN_TIME = 1 // 1 second
const MAX_TIME = 3600 // 60 minutes in seconds

function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  if (mins > 0) {
    return `${mins}:${secs.toString().padStart(2, "0")}`
  }
  return `${secs}s`
}

function getPhaseInfo(phase: TimerPhase, currentSet: number, totalSets: number, config: HIITConfig): PhaseInfo {
  switch (phase) {
    case "prep":
      return {
        label: "Prep",
        nextLabel: `Work (${formatTime(config.work)}s)`,
        color: "oklch(0.70 0.15 162)", // primary
      }
    case "work":
      return {
        label: "Work",
        nextLabel: currentSet < totalSets ? `Rest (${formatTime(config.rest)}s)` : config.cooldown > 0 ? `Cooldown (${formatTime(config.cooldown)}s)` : undefined,
        color: "oklch(0.704 0.191 22.216)", // destructive/red for work
      }
    case "rest":
      return {
        label: "Rest",
        nextLabel: `Work (${formatTime(config.work)}s)`,
        color: "oklch(0.85 0.13 165)", // chart-1/green for rest
      }
    case "cooldown":
      return {
        label: "Cooldown",
        nextLabel: undefined,
        color: "oklch(0.70 0.15 162)", // primary
      }
    case "complete":
      return {
        label: "Complete!",
        nextLabel: undefined,
        color: "oklch(0.85 0.13 165)",
      }
    default:
      return {
        label: "",
        color: "oklch(0.70 0.15 162)",
      }
  }
}

function validateConfig(config: Partial<HIITConfig>): string | null {
  if (!config.prep || config.prep < MIN_TIME || config.prep > MAX_TIME) {
    return `Prep must be between ${MIN_TIME}s and ${MAX_TIME}s (60 minutes)`
  }
  if (!config.sets || config.sets < 1) {
    return "Sets must be at least 1"
  }
  if (!config.work || config.work < MIN_TIME || config.work > MAX_TIME) {
    return `Work must be between ${MIN_TIME}s and ${MAX_TIME}s (60 minutes)`
  }
  if (!config.rest || config.rest < MIN_TIME || config.rest > MAX_TIME) {
    return `Rest must be between ${MIN_TIME}s and ${MAX_TIME}s (60 minutes)`
  }
  if (config.cooldown !== undefined && config.cooldown !== null && (config.cooldown < 0 || config.cooldown > MAX_TIME)) {
    return `Cooldown must be between 0s and ${MAX_TIME}s (60 minutes)`
  }
  return null
}

function initializeTimerState(config: HIITConfig, autoStart: boolean = true): TimerState {
  return {
    phase: "prep",
    currentSet: 1,
    timeRemaining: config.prep,
    totalTime: config.prep,
    isPaused: !autoStart,
    config,
  }
}

function getNextPhase(state: TimerState): TimerPhase {
  const { phase, currentSet, config } = state

  switch (phase) {
    case "prep":
      return "work"
    case "work":
      if (currentSet < config.sets) {
        return "rest"
      } else if (config.cooldown > 0) {
        return "cooldown"
      } else {
        return "complete"
      }
    case "rest":
      return "work"
    case "cooldown":
      return "complete"
    default:
      return phase
  }
}

function getPhaseDuration(phase: TimerPhase, state: TimerState): number {
  const { config, currentSet } = state
  switch (phase) {
    case "prep":
      return config.prep
    case "work":
      return config.work
    case "rest":
      return config.rest
    case "cooldown":
      return config.cooldown
    default:
      return 0
  }
}

export function HIITTimer() {
  const [config, setConfig] = React.useState<Partial<HIITConfig>>({
    prep: 10,
    sets: 4,
    work: 20,
    rest: 10,
    cooldown: 60,
  })
  const [error, setError] = React.useState<string | null>(null)
  const [timerState, setTimerState] = React.useState<TimerState | null>(null)
  const intervalRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const wakeLockRef = React.useRef<WakeLockSentinel | null>(null)

  // Wake Lock functions
  const requestWakeLock = React.useCallback(async () => {
    if ('wakeLock' in navigator) {
      try {
        const wakeLock = await navigator.wakeLock.request('screen')
        wakeLockRef.current = wakeLock

        // Handle when wake lock is released (e.g., user switches tabs)
        wakeLock.addEventListener('release', () => {
          wakeLockRef.current = null
        })
      } catch (err) {
        // Wake lock request failed (e.g., user denied permission, browser doesn't support it)
        console.warn('Wake lock request failed:', err)
      }
    }
  }, [])

  const releaseWakeLock = React.useCallback(async () => {
    if (wakeLockRef.current) {
      try {
        await wakeLockRef.current.release()
        wakeLockRef.current = null
      } catch (err) {
        console.warn('Wake lock release failed:', err)
      }
    }
  }, [])

  // Cleanup interval and wake lock on unmount
  React.useEffect(() => {
    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
      releaseWakeLock()
    }
  }, [releaseWakeLock])

  // Timer interval logic
  React.useEffect(() => {
    if (!timerState || timerState.isPaused || timerState.phase === "complete") {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
      return
    }

    intervalRef.current = setInterval(() => {
      setTimerState((prev) => {
        if (!prev) return null

        if (prev.timeRemaining <= 1) {
          const nextPhase = getNextPhase(prev)
          if (nextPhase === "complete") {
            return {
              ...prev,
              phase: "complete",
              timeRemaining: 0,
              isPaused: true,
            }
          }
          if (nextPhase === "work" && prev.phase === "rest") {
            return {
              ...prev,
              phase: "work",
              currentSet: prev.currentSet + 1,
              timeRemaining: prev.config.work,
              totalTime: prev.config.work,
            }
          }
          const duration = getPhaseDuration(nextPhase, prev)
          return {
            ...prev,
            phase: nextPhase,
            timeRemaining: duration,
            totalTime: duration,
          }
        }

        return {
          ...prev,
          timeRemaining: prev.timeRemaining - 1,
        }
      })
    }, 1000)

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [timerState?.isPaused, timerState?.phase])

  // Manage wake lock based on timer state
  React.useEffect(() => {
    if (timerState && !timerState.isPaused && timerState.phase !== 'complete') {
      // Request wake lock when timer is running
      requestWakeLock()
    } else {
      // Release wake lock when paused or complete
      releaseWakeLock()
    }
  }, [timerState?.isPaused, timerState?.phase, requestWakeLock, releaseWakeLock])

  // Handle visibility change (when user switches tabs/apps)
  React.useEffect(() => {
    const handleVisibilityChange = async () => {
      if (
        document.visibilityState === 'visible' &&
        timerState &&
        !timerState.isPaused &&
        timerState.phase !== 'complete'
      ) {
        // Re-request wake lock if it was released
        if (!wakeLockRef.current) {
          await requestWakeLock()
        }
      }
    }

    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
    }
  }, [timerState?.isPaused, timerState?.phase, requestWakeLock])

  const handleStart = () => {
    const validationError = validateConfig(config)
    if (validationError) {
      setError(validationError)
      return
    }

    setError(null)
    const fullConfig: HIITConfig = {
      prep: config.prep!,
      sets: config.sets!,
      work: config.work!,
      rest: config.rest!,
      cooldown: config.cooldown || 0,
    }
    setTimerState(initializeTimerState(fullConfig, true))
  }

  const handlePause = () => {
    setTimerState((prev) => (prev ? { ...prev, isPaused: true } : null))
  }

  const handlePlay = () => {
    setTimerState((prev) => (prev ? { ...prev, isPaused: false } : null))
  }

  const handleRestart = () => {
    if (!timerState) return
    const fullConfig: HIITConfig = {
      prep: timerState.config.prep,
      sets: timerState.config.sets,
      work: timerState.config.work,
      rest: timerState.config.rest,
      cooldown: timerState.config.cooldown,
    }
    setTimerState(initializeTimerState(fullConfig))
  }

  const handleSkipSet = () => {
    setTimerState((prev) => {
      if (!prev) return null
      const nextPhase = getNextPhase(prev)
      if (nextPhase === "complete") {
        return {
          ...prev,
          phase: "complete",
          timeRemaining: 0,
          isPaused: true,
        }
      }
      const duration = getPhaseDuration(nextPhase, prev)
      const newSet = nextPhase === "work" && prev.phase === "rest" ? prev.currentSet + 1 : prev.currentSet
      return {
        ...prev,
        phase: nextPhase,
        currentSet: newSet,
        timeRemaining: duration,
        totalTime: duration,
      }
    })
  }

  const handlePreset = (preset: "tabata") => {
    if (preset === "tabata") {
      setConfig({
        prep: 10,
        sets: 8,
        work: 20,
        rest: 10,
        cooldown: 60,
      })
      setError(null)
    }
  }

  const isActive = timerState !== null && timerState.phase !== "complete"
  const phaseInfo = timerState ? getPhaseInfo(timerState.phase, timerState.currentSet, timerState.config.sets, timerState.config) : null
  const progress = timerState && timerState.totalTime > 0
    ? ((timerState.totalTime - timerState.timeRemaining) / timerState.totalTime) * 100
    : 0

  return (
    <div className="min-h-screen bg-background text-foreground p-4 max-w-md mx-auto">
      {!isActive ? (
        // Setup Screen
        <div className="space-y-6">
          <div className="text-center space-y-2">
            <h1 className="text-3xl font-bold">HIIT Flow</h1>
            <p className="text-muted-foreground">Configure your workout</p>
          </div>

          {/* Quick Presets */}
          <div className="space-y-2">
            <Label className="text-xs text-muted-foreground">Quick Presets</Label>
            <Button
              variant="outline"
              size="sm"
              onClick={() => handlePreset("tabata")}
              className="w-full"
            >
              Tabata (20s work / 10s rest)
            </Button>
          </div>

          {/* Input Grid */}
          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="prep">Prep</Label>
              <div className="relative">
                <Input
                  id="prep"
                  type="number"
                  min={MIN_TIME}
                  max={MAX_TIME}
                  value={config.prep || ""}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10)
                    setConfig({ ...config, prep: isNaN(value) ? undefined : value })
                    setError(null)
                  }}
                  placeholder="10"
                  aria-invalid={error?.includes("Prep") ? true : undefined}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                  s
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="sets">Sets</Label>
              <div className="relative">
                <Input
                  id="sets"
                  type="number"
                  min={1}
                  value={config.sets || ""}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10)
                    setConfig({ ...config, sets: isNaN(value) ? undefined : value })
                    setError(null)
                  }}
                  placeholder="4"
                  aria-invalid={error?.includes("Sets") ? true : undefined}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                  qty
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="work">Work</Label>
              <div className="relative">
                <Input
                  id="work"
                  type="number"
                  min={MIN_TIME}
                  max={MAX_TIME}
                  value={config.work || ""}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10)
                    setConfig({ ...config, work: isNaN(value) ? undefined : value })
                    setError(null)
                  }}
                  placeholder="20"
                  aria-invalid={error?.includes("Work") ? true : undefined}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                  s
                </span>
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="rest">Rest</Label>
              <div className="relative">
                <Input
                  id="rest"
                  type="number"
                  min={MIN_TIME}
                  max={MAX_TIME}
                  value={config.rest || ""}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10)
                    setConfig({ ...config, rest: isNaN(value) ? undefined : value })
                    setError(null)
                  }}
                  placeholder="10"
                  aria-invalid={error?.includes("Rest") ? true : undefined}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                  s
                </span>
              </div>
            </div>

            <div className="space-y-2 col-span-2">
              <Label htmlFor="cooldown">Cooldown (Optional)</Label>
              <div className="relative">
                <Input
                  id="cooldown"
                  type="number"
                  min={0}
                  max={MAX_TIME}
                  value={config.cooldown || ""}
                  onChange={(e) => {
                    const value = parseInt(e.target.value, 10)
                    setConfig({ ...config, cooldown: isNaN(value) ? undefined : value })
                    setError(null)
                  }}
                  placeholder="60"
                  aria-invalid={error?.includes("Cooldown") ? true : undefined}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground text-sm pointer-events-none">
                  s
                </span>
              </div>
            </div>
          </div>

          {error && (
            <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm">
              {error}
            </div>
          )}

          <Button
            onClick={handleStart}
            className="w-full h-12 text-lg"
            disabled={!config.prep || !config.sets || !config.work || !config.rest}
          >
            Start Workout
          </Button>
        </div>
      ) : (
        // Active Timer Screen
        <div className="flex flex-col items-center justify-center min-h-[calc(100vh-2rem)] space-y-8 relative">
          {phaseInfo?.nextLabel && (
            <NextUpLabel label={phaseInfo.nextLabel} position="top-right" />
          )}

          <div className="text-center space-y-2">
            <p className="text-lg font-medium text-muted-foreground">{phaseInfo?.label}</p>
            {timerState && timerState.phase !== "complete" && (
              <p className="text-sm text-muted-foreground">
                Set {timerState.currentSet} of {timerState.config.sets}
              </p>
            )}
          </div>

          <CircularProgress
            progress={progress}
            size={280}
            strokeWidth={14}
            color={phaseInfo?.color}
          >
            <div className="text-center">
              <div className="text-5xl font-bold tabular-nums">
                {timerState ? formatTime(timerState.timeRemaining) : "0:00"}
              </div>
            </div>
          </CircularProgress>

          <ControlBar
            isPaused={timerState?.isPaused ?? false}
            onPlay={handlePlay}
            onPause={handlePause}
            onRestart={handleRestart}
            onSkipSet={handleSkipSet}
          />

          {timerState?.phase === "complete" && (
            <div className="text-center space-y-4">
              <p className="text-2xl font-bold text-primary">Workout Complete!</p>
              <Button onClick={() => setTimerState(null)} variant="outline">
                New Workout
              </Button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}

