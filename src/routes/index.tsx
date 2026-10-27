import { createFileRoute } from "@tanstack/react-router";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Minus, Plus, X, Settings, Maximize, Minimize } from "lucide-react";

export const Route = createFileRoute("/")({
  component: Index,
});

const DEFAULT_WORK = 45;
const DEFAULT_REST = 15;
const DEFAULT_EXERCISES = 5;
const DEFAULT_ROUNDS = [3, 3, 2];
const STEP = 1;
const MIN_SECONDS = 0;
const MAX_SECONDS = 60 * 60;
const MIN_COUNT = 1;
const MAX_COUNT = 20;

const fmt = (s: number) =>
  `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

type Phase = "work" | "rest" | "break";

function locate(index: number, rounds: number[], perCircuit: number) {
  let remaining = index;
  for (let c = 0; c < rounds.length; c++) {
    const size = rounds[c] * perCircuit;
    if (remaining < size) {
      return {
        circuit: c,
        round: Math.floor(remaining / perCircuit),
        exercise: remaining % perCircuit,
      };
    }
    remaining -= size;
  }
  return {
    circuit: rounds.length - 1,
    round: rounds[rounds.length - 1] - 1,
    exercise: perCircuit - 1,
  };
}

function Index() {
  const [workSeconds, setWorkSeconds] = useState(DEFAULT_WORK);
  const [restSeconds, setRestSeconds] = useState(DEFAULT_REST);
  const [perCircuit, setPerCircuit] = useState(DEFAULT_EXERCISES);
  const [rounds, setRounds] = useState<number[]>(DEFAULT_ROUNDS);
  const [exerciseIndex, setExerciseIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("work");
  const [remaining, setRemaining] = useState(DEFAULT_WORK);
  const [running, setRunning] = useState(false);
  const [done, setDone] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [celebrate, setCelebrate] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const phaseRef = useRef(phase);
  phaseRef.current = phase;
  const workRef = useRef(workSeconds);
  workRef.current = workSeconds;
  const restRef = useRef(restSeconds);
  restRef.current = restSeconds;
  const remainingRef = useRef(remaining);
  const setRem = useCallback((v: number) => {
    remainingRef.current = v;
    setRemaining(v);
  }, []);
  const totalExercises = useMemo(
    () => rounds.reduce((sum, r) => sum + r * perCircuit, 0),
    [rounds, perCircuit],
  );
  const totalRef = useRef(totalExercises);
  totalRef.current = totalExercises;
  const roundsRef = useRef(rounds);
  roundsRef.current = rounds;
  const perCircuitRef = useRef(perCircuit);
  perCircuitRef.current = perCircuit;
  const idxRef = useRef(exerciseIndex);
  idxRef.current = exerciseIndex;
  const lastBackRef = useRef(0);

  useEffect(() => {
    document.documentElement.classList.add("dark");
  }, []);

  useEffect(() => {
    const onChange = () => setIsFullscreen(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!running) return;
    const id = setInterval(() => {
      if (remainingRef.current > 1) {
        remainingRef.current -= 1;
        setRemaining(remainingRef.current);
        return;
      }
      const idx = idxRef.current;
      const total = totalRef.current;
      if (phaseRef.current === "work") {
        // last exercise finishes on work — no trailing rest
        if (idx + 1 >= total) {
          setDone(true);
          setRunning(false);
          setRem(0);
          return;
        }
        // if next exercise is in a new circuit, replace rest with a break
        const curC = locate(idx, roundsRef.current, perCircuitRef.current).circuit;
        const nextC = locate(idx + 1, roundsRef.current, perCircuitRef.current).circuit;
        if (nextC !== curC) {
          idxRef.current = idx + 1;
          setExerciseIndex(idx + 1);
          phaseRef.current = "break";
          setPhase("break");
          setRunning(false);
          setRem(0);
          return;
        }
        phaseRef.current = "rest";
        setPhase("rest");
        setRem(restRef.current);
        return;
      }
      // rest ended -> advance to next exercise
      const next = idx + 1;
      idxRef.current = next;
      setExerciseIndex(next);
      if (next >= total) {
        setDone(true);
        setRunning(false);
        setRem(0);
        return;
      }
      phaseRef.current = "work";
      setPhase("work");
      setRem(workRef.current);
    }, 1000);
    return () => clearInterval(id);
  }, [running, setRem]);

  // Trigger fireworks immediately when training completes
  useEffect(() => {
    if (!done) return;
    setCelebrate(true);
  }, [done]);

  const isWork = phase === "work";
  const isBreak = phase === "break";
  const pos = locate(Math.min(exerciseIndex, totalExercises - 1), rounds, perCircuit);
  const globalRound = Math.min(exerciseIndex + 1, totalExercises);
  const totalRounds = useMemo(
    () => rounds.reduce((s, r) => s + r, 0),
    [rounds],
  );
  const completedSecs =
    exerciseIndex * (workSeconds + restSeconds) +
    (isWork ? workSeconds - remaining : workSeconds + (restSeconds - remaining));
  const trainingTotalSecs = totalExercises * (workSeconds + restSeconds);
  const overallPct = done
    ? 100
    : Math.min(100, (completedSecs / trainingTotalSecs) * 100);

  const toggle = () => {
    if (phase === "break") {
      setPhase("work");
      setRem(workSeconds);
      setRunning(true);
      return;
    }
    setRunning((r) => !r);
  };
  const reset = () => {
    setRunning(false);
    setDone(false);
    setCelebrate(false);
    setExerciseIndex(0);
    setPhase("work");
    setRem(workSeconds);
  };
  const skip = () => {
    if (phase === "break") {
      setPhase("work");
      setRem(workSeconds);
      setRunning(true);
      return;
    }
    const nextIdx = exerciseIndex + 1;
    if (nextIdx >= totalExercises) {
      setDone(true);
      setRunning(false);
      return;
    }
    const prevC = locate(exerciseIndex, rounds, perCircuit).circuit;
    const nextC = locate(nextIdx, rounds, perCircuit).circuit;
    setExerciseIndex(nextIdx);
    if (nextC !== prevC) {
      setPhase("break");
      setRunning(false);
      setRem(0);
    } else {
      setPhase("work");
      setRem(workSeconds);
      setRunning(true);
    }
  };

  const back = () => {
    const now = Date.now();
    const isDouble = now - lastBackRef.current < 350;
    lastBackRef.current = now;
    setDone(false);
    setPhase("work");
    setRem(workSeconds);
    setRunning(true);
    if (isDouble && exerciseIndex > 0) {
      const prev = exerciseIndex - 1;
      idxRef.current = prev;
      setExerciseIndex(prev);
      lastBackRef.current = 0;
    }
  };

  const finish = () => {
    reset();
  };

  const adjust = (kind: Phase, delta: number) => {
    const setter = kind === "work" ? setWorkSeconds : setRestSeconds;
    setter((current) => {
      const next = Math.max(MIN_SECONDS, Math.min(MAX_SECONDS, current + delta));
      if (!running && phase === kind) setRem(next);
      return next;
    });
  };

  const adjustCount = (
    kind: "exercises" | "circuit",
    delta: number,
    circuitIdx?: number,
  ) => {
    if (kind === "exercises") {
      setPerCircuit((v) => Math.max(MIN_COUNT, Math.min(MAX_COUNT, v + delta)));
    } else if (circuitIdx !== undefined) {
      setRounds((rs) =>
        rs.map((r, i) =>
          i === circuitIdx ? Math.max(MIN_COUNT, Math.min(MAX_COUNT, r + delta)) : r,
        ),
      );
    }
  };

  const mm = String(Math.floor(remaining / 60)).padStart(2, "0");
  const ss = String(remaining % 60).padStart(2, "0");

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement) {
        await document.documentElement.requestFullscreen();
      } else {
        await document.exitFullscreen();
      }
    } catch {
      // ignore unsupported fullscreen
    }
  };

  return (
    <main className="min-h-screen bg-background text-foreground flex flex-col items-center justify-center px-6 py-8">
      <div className="fixed top-4 right-4 flex items-center gap-2 z-10">
        <button
          onClick={toggleFullscreen}
          aria-label={isFullscreen ? "Exit fullscreen" : "Enter fullscreen"}
          aria-pressed={isFullscreen}
          className="p-2 rounded-full border border-input hover:bg-accent transition bg-background"
        >
          {isFullscreen ? (
            <Minimize className="w-4 h-4" />
          ) : (
            <Maximize className="w-4 h-4" />
          )}
        </button>
        <button
          onClick={() => setSettingsOpen((o) => !o)}
          aria-label="Open settings"
          aria-expanded={settingsOpen}
          className="p-2 rounded-full border border-input hover:bg-accent transition bg-background"
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <div className="flex flex-col items-center">
        <div
          className={`font-semibold tabular-nums leading-none transition-colors duration-500 ${
            done
              ? "text-foreground"
              : isWork
              ? "text-primary"
              : "text-chart-2"
          }`}
          style={{ fontSize: "clamp(6rem, 28vw, 18rem)" }}
        >
          {mm}:{ss}
        </div>
        {done ? (
          <div className="mt-6 text-sm uppercase tracking-[0.25em] text-muted-foreground">
            Training complete
          </div>
        ) : (
          <>
            <div className="mt-6 text-xl sm:text-2xl uppercase tracking-[0.25em] text-muted-foreground">
              {isBreak
                ? `Break`
                : isWork
                ? `Round ${globalRound}`
                : `Rest ${globalRound}`}
            </div>
            <div className="mt-3 flex gap-4 text-[10px] uppercase tracking-[0.2em] text-muted-foreground/70">
              <span>C {pos.circuit + 1}/{rounds.length}</span>
              <span>R {pos.round + 1}/{rounds[pos.circuit]}</span>
              <span>E {pos.exercise + 1}/{perCircuit}</span>
            </div>
          </>
        )}
      </div>

      <div className="mt-8 w-full max-w-md">
        <div className="flex justify-between text-[10px] uppercase tracking-[0.25em] text-muted-foreground mb-2">
          <span>Overall</span>
          <span>{Math.round(overallPct)}%</span>
        </div>
        <div className="h-1.5 w-full rounded-full bg-muted overflow-hidden">
          <div
            className="h-full bg-primary transition-all duration-500"
            style={{ width: `${overallPct}%` }}
          />
        </div>
      </div>

      <div className="flex gap-3 mt-8">
        <HoldButton
          onTrigger={back}
          holdMs={800}
          onHold={reset}
          className="px-5 py-3 rounded-full border border-input text-sm font-medium hover:bg-accent transition"
          aria-label="Back (hold to reset)"
        >
          Back
        </HoldButton>
        <button
          onClick={done ? finish : toggle}
          className="px-8 py-3 rounded-full bg-primary text-primary-foreground text-sm font-semibold hover:opacity-90 transition min-w-32"
        >
          {running
            ? "Pause"
            : done
            ? "Reset"
            : exerciseIndex === 0 && phase === "work" && remaining === workSeconds
            ? "Start"
            : "Resume"}
        </button>
        <button
          onClick={skip}
          disabled={done}
          className="px-5 py-3 rounded-full border border-input text-sm font-medium hover:bg-accent transition"
        >
          Next
        </button>
      </div>

      {celebrate && <Fireworks />}

      {settingsOpen && (
        <div
          className="fixed inset-0 z-20 bg-background/80 backdrop-blur-sm flex items-start sm:items-center justify-center p-4 overflow-y-auto"
          onClick={() => setSettingsOpen(false)}
        >
          <div
            className="w-full max-w-md bg-background border border-border rounded-2xl p-6 my-8"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xs uppercase tracking-[0.25em] text-muted-foreground">
                Training structure
              </h2>
              <button
                onClick={() => setSettingsOpen(false)}
                aria-label="Close settings"
                className="p-1.5 rounded-full border border-input hover:bg-accent transition"
              >
                <X className="w-3 h-3" />
              </button>
            </div>

            <div className="grid grid-cols-2 gap-6 mb-6">
              {(["work", "rest"] as const).map((kind) => {
                const value = kind === "work" ? workSeconds : restSeconds;
                const color = kind === "work" ? "text-primary" : "text-chart-2";
                return (
                  <div key={kind} className="flex flex-col items-center">
                    <div className={`text-[10px] uppercase tracking-[0.25em] font-medium mb-2 ${color}`}>
                      {kind === "work" ? "Workout" : "Rest"}
                    </div>
                    <div className="flex items-center gap-2">
                      <HoldButton
                        onTrigger={() => adjust(kind, -STEP)}
                        aria-label={`Decrease ${kind} time`}
                        className="p-2 rounded-full border border-input hover:bg-accent transition disabled:opacity-40"
                        disabled={value <= MIN_SECONDS}
                      >
                        <Minus className="w-3 h-3" />
                      </HoldButton>
                      <div className="text-lg font-semibold tabular-nums w-14 text-center">
                        {fmt(value)}
                      </div>
                      <HoldButton
                        onTrigger={() => adjust(kind, STEP)}
                        aria-label={`Increase ${kind} time`}
                        className="p-2 rounded-full border border-input hover:bg-accent transition disabled:opacity-40"
                        disabled={value >= MAX_SECONDS}
                      >
                        <Plus className="w-3 h-3" />
                      </HoldButton>
                    </div>
                  </div>
                );
              })}
            </div>

            <div className="flex flex-col gap-3 border-t border-border pt-4">
            <div className="flex items-center gap-2">
              <div className="flex-1">
                <Stepper
                  label="Exercises per circuit"
                  value={perCircuit}
                  onDec={() => adjustCount("exercises", -1)}
                  onInc={() => adjustCount("exercises", 1)}
                  min={MIN_COUNT}
                  max={MAX_COUNT}
                />
              </div>
              <span aria-hidden className="w-6 h-6 shrink-0" />
            </div>
            {rounds.map((r, i) => (
              <div key={i} className="flex items-center gap-2">
                <div className="flex-1">
                  <Stepper
                    label={`Circuit ${i + 1}: number of rounds`}
                    value={r}
                    onDec={() => adjustCount("circuit", -1, i)}
                    onInc={() => adjustCount("circuit", 1, i)}
                    min={MIN_COUNT}
                    max={MAX_COUNT}
                  />
                </div>
                <button
                  onClick={() =>
                    setRounds((rs) => (rs.length > 1 ? rs.filter((_, j) => j !== i) : rs))
                  }
                  disabled={rounds.length <= 1}
                  aria-label={`Remove circuit ${i + 1}`}
                  className="p-1.5 rounded-full border border-input hover:bg-accent transition disabled:opacity-40 shrink-0"
                >
                  <X className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={() => setRounds((rs) => [...rs, 2])}
              className="mt-1 px-3 py-2 rounded-full border border-input text-xs font-medium hover:bg-accent transition self-center inline-flex items-center gap-1"
            >
              <Plus className="w-3 h-3" /> Add circuit
            </button>
            <div className="text-xs text-muted-foreground text-center pt-1">
              {totalExercises} exercises · ~{fmt(trainingTotalSecs)} total
            </div>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}

function HoldButton({
  onTrigger,
  onHold,
  holdMs,
  disabled,
  children,
  className,
  ...rest
}: {
  onTrigger: () => void;
  onHold?: () => void;
  holdMs?: number;
  disabled?: boolean;
  children: React.ReactNode;
  className?: string;
  "aria-label"?: string;
}) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const holdTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const heldRef = useRef(false);
  const triggerRef = useRef(onTrigger);
  triggerRef.current = onTrigger;
  const holdCbRef = useRef(onHold);
  holdCbRef.current = onHold;

  const stop = useCallback(() => {
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    if (intervalRef.current) clearInterval(intervalRef.current);
    if (holdTimeoutRef.current) clearTimeout(holdTimeoutRef.current);
    timeoutRef.current = null;
    intervalRef.current = null;
    holdTimeoutRef.current = null;
  }, []);

  const start = useCallback(() => {
    if (disabled) return;
    heldRef.current = false;
    if (holdCbRef.current && holdMs) {
      holdTimeoutRef.current = setTimeout(() => {
        heldRef.current = true;
        holdCbRef.current?.();
      }, holdMs);
    } else {
      triggerRef.current();
      timeoutRef.current = setTimeout(() => {
        intervalRef.current = setInterval(() => triggerRef.current(), 60);
      }, 400);
    }
  }, [disabled, holdMs]);

  const release = useCallback(() => {
    const wasHold = heldRef.current;
    stop();
    if (holdCbRef.current && holdMs && !wasHold && !disabled) {
      triggerRef.current();
    }
  }, [stop, holdMs, disabled]);

  useEffect(() => () => stop(), [stop]);

  return (
    <button
      type="button"
      disabled={disabled}
      className={className}
      aria-label={rest["aria-label"]}
      onPointerDown={(e) => {
        e.preventDefault();
        (e.currentTarget as HTMLButtonElement).setPointerCapture(e.pointerId);
        start();
      }}
      onPointerUp={release}
      onPointerLeave={stop}
      onPointerCancel={stop}
    >
      {children}
    </button>
  );
}

function Fireworks() {
  const BURSTS = 18;
  const PARTICLES = 28;
  const bursts = Array.from({ length: BURSTS });
  return (
    <div className="fixed inset-0 z-30 pointer-events-none overflow-hidden">
      {bursts.map((_, b) => {
        const left = 8 + Math.random() * 84;
        const top = 12 + Math.random() * 60;
        const burstDelay = Math.random() * 1.8;
        const hue = Math.floor(Math.random() * 360);
        const size = 40 + Math.random() * 80;
        return (
          <div
            key={b}
            className="absolute"
            style={{ left: `${left}%`, top: `${top}%` }}
          >
            {Array.from({ length: PARTICLES }).map((_, p) => {
              const angle = (p / PARTICLES) * Math.PI * 2 + Math.random() * 0.3;
              const dist = size * (0.6 + Math.random() * 0.6);
              const dx = Math.cos(angle) * dist;
              const dy = Math.sin(angle) * dist;
              const h = (hue + Math.random() * 40 - 20 + 360) % 360;
              const dur = 1.1 + Math.random() * 0.6;
              return (
                <span
                  key={p}
                  className="absolute rounded-full"
                  style={{
                    left: 0,
                    top: 0,
                    width: 5,
                    height: 5,
                    marginLeft: -2.5,
                    marginTop: -2.5,
                    background: `hsl(${h}, 95%, 65%)`,
                    boxShadow: `0 0 10px hsl(${h}, 95%, 65%), 0 0 20px hsl(${h}, 95%, 65%)`,
                    // pass motion via CSS variables consumed by the keyframes
                    ["--dx" as string]: `${dx}px`,
                    ["--dy" as string]: `${dy}px`,
                    animation: `spark ${dur}s cubic-bezier(.15,.7,.3,1) ${burstDelay}s forwards`,
                  }}
                />
              );
            })}
            <span
              className="absolute rounded-full"
              style={{
                left: 0,
                top: 0,
                width: 10,
                height: 10,
                marginLeft: -5,
                marginTop: -5,
                background: `hsl(${hue}, 100%, 85%)`,
                boxShadow: `0 0 30px hsl(${hue}, 100%, 70%)`,
                animation: `flash 0.5s ease-out ${burstDelay}s forwards`,
              }}
            />
          </div>
        );
      })}
      <style>{`
        @keyframes spark {
          0% { transform: translate(0,0) scale(1); opacity: 1; }
          70% { opacity: 1; }
          100% { transform: translate(var(--dx), calc(var(--dy) + 40px)) scale(0.4); opacity: 0; }
        }
        @keyframes flash {
          0% { transform: scale(0.2); opacity: 1; }
          100% { transform: scale(3); opacity: 0; }
        }
      `}</style>
    </div>
  );
}

function Stepper({
  label,
  value,
  onDec,
  onInc,
  min,
  max,
}: {
  label: string;
  value: number;
  onDec: () => void;
  onInc: () => void;
  min: number;
  max: number;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <span className="text-sm text-foreground">{label}</span>
      <div className="flex items-center gap-2">
        <button
          onClick={onDec}
          disabled={value <= min}
          aria-label={`Decrease ${label}`}
          className="p-1.5 rounded-full border border-input hover:bg-accent transition disabled:opacity-40"
        >
          <Minus className="w-3 h-3" />
        </button>
        <div className="text-sm font-semibold tabular-nums w-8 text-center">{value}</div>
        <button
          onClick={onInc}
          disabled={value >= max}
          aria-label={`Increase ${label}`}
          className="p-1.5 rounded-full border border-input hover:bg-accent transition disabled:opacity-40"
        >
          <Plus className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}
