export interface HIITConfig {
  prep: number; // seconds
  sets: number; // quantity
  work: number; // seconds
  rest: number; // seconds
  cooldown: number; // seconds (optional)
}

export type TimerPhase = "prep" | "work" | "rest" | "cooldown" | "complete";

export interface TimerState {
  phase: TimerPhase;
  currentSet: number;
  timeRemaining: number; // seconds
  totalTime: number; // seconds
  isPaused: boolean;
  config: HIITConfig;
}

export interface PhaseInfo {
  label: string;
  nextLabel?: string;
  color: string;
}
