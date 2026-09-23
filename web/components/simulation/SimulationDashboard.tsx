"use client";

import { Canvas } from "@react-three/fiber";
import {
  Activity,
  Brain,
  Check,
  CircleStop,
  Pause,
  Play,
  Radio,
  RotateCcw,
  Square,
  Timer,
  Wifi,
} from "lucide-react";

import { ActionButton } from "@/components/layout/ActionButton";
import { Sidebar } from "@/components/layout/Sidebar";
import { useSimulation } from "@/hooks/useSimulation";
import { useSimulationRealtime } from "@/hooks/useSimulationRealtime";
import { cn } from "@/utils/cn";
import { formatSimulationTime, formatUpdatedAt } from "@/utils/formats";
import { stateMeta } from "@/utils/simulations/state";
import { SimulationViewport } from "./SimulationViewport";

function Metric({
  label,
  value,
  accent = "text-white",
}: {
  readonly label: string;
  readonly value: string;
  readonly accent?: string;
}) {
  return (
    <div>
      <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
        {label}
      </p>
      <p className={cn("mt-2 font-mono text-lg tracking-tight", accent)}>
        {value}
      </p>
    </div>
  );
}

export function SimulationDashboard() {
  const { health, status, actions, isActionPending } = useSimulation();
  const { event, connected } = useSimulationRealtime();
  const simulation = status.data;
  const state = event?.status ?? simulation?.state ?? "idle";
  const meta = stateMeta[state];
  const canStart = ["idle", "stopped", "error"].includes(state);
  const canPause = state === "running";
  const canResume = state === "paused";
  const canReset = canPause || canResume;
  const canStop = ["starting", "running", "paused", "resetting"].includes(state);
  const actionError =
    actions.start.error ??
    actions.pause.error ??
    actions.resume.error ??
    actions.reset.error ??
    actions.stop.error;
  const simulationTime = event?.simulation_time ?? simulation?.simulation_time;
  const scene = event?.scene ?? null;

  return (
    <div className="min-h-dvh overflow-hidden bg-[#071210] text-white">
      <Sidebar />

      <main className="relative min-h-dvh pl-17">
        <div className="absolute inset-0">
          <Canvas
            shadows
            dpr={[1, 2]}
            gl={{ antialias: true, alpha: false, logarithmicDepthBuffer: true }}
          >
            <SimulationViewport scene={scene} flyState={event?.fly_state ?? null} />
          </Canvas>
        </div>

        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_50%_45%,transparent_0%,rgba(4,13,11,0.08)_44%,rgba(4,13,11,0.56)_100%)]" />
        <div className="pointer-events-none absolute inset-x-0 top-0 h-44 bg-gradient-to-b from-[#071210]/90 to-transparent" />

        <header className="pointer-events-none relative z-10 flex items-start justify-between gap-5 px-6 py-5 sm:px-9 lg:px-12">
          <div>
            <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.24em] text-emerald-300/75">
              <span className="size-1.5 rounded-full bg-emerald-300 shadow-[0_0_14px_rgba(110,231,183,0.8)]" />
              FlyGym / live scene
            </div>
            <h1 className="mt-3 text-2xl font-medium tracking-[-0.04em] text-white sm:text-3xl">
              NeuroMechFly in motion
            </h1>
            <p className="mt-2 max-w-md text-sm leading-5 text-white/48">
              The browser is following the same body state produced by the MuJoCo runtime.
            </p>
          </div>

          <div className="flex shrink-0 items-center gap-2 rounded-full border border-white/10 bg-[#0b1c18]/70 px-3 py-2 text-xs backdrop-blur-xl">
            <span
              className={cn(
                "size-2 rounded-full",
                connected ? "bg-emerald-300 shadow-[0_0_12px_#6ee7b7]" : "bg-amber-300",
              )}
            />
            <span className="text-white/70">{connected ? "Live stream" : "Reconnecting"}</span>
          </div>
        </header>

        <div className="pointer-events-none relative z-10 flex min-h-[calc(100dvh-100px)] flex-col justify-between gap-8 px-6 pb-6 sm:px-9 sm:pb-9 lg:px-12">
          <div className="flex justify-end">
            <aside className="pointer-events-auto w-full max-w-90 rounded-3xl border border-white/10 bg-[#0a1815]/78 p-5 shadow-2xl shadow-black/20 backdrop-blur-2xl sm:p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2.5">
                  <div className="flex size-9 items-center justify-center rounded-2xl bg-emerald-300/10 text-emerald-200">
                    <Radio className="size-4" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-white">Simulation control</p>
                    <p className="mt-0.5 text-[11px] text-white/40">REST control · WebSocket state</p>
                  </div>
                </div>
                <span className={cn("flex items-center gap-2 text-xs", meta.color.replace("700", "200"))}>
                  <span className={cn("size-1.5 rounded-full", meta.dot)} />
                  {meta.label}
                </span>
              </div>

              <div className="mt-6 rounded-2xl border border-white/8 bg-black/15 p-4">
                <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-white/35">Simulation time</p>
                <p className="mt-2 font-mono text-4xl tracking-[-0.06em] text-white">
                  {formatSimulationTime(simulationTime)}
                </p>
                <p className="mt-2 text-xs text-white/40">{event?.message ?? simulation?.message ?? "Ready to initialize"}</p>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-2">
                <ActionButton
                  tone="primary"
                  icon={<Play className="size-3.5" fill="currentColor" />}
                  disabled={!canStart || isActionPending || status.isLoading}
                  loading={actions.start.isPending}
                  onClick={() => actions.start.mutate(false)}
                >
                  Start
                </ActionButton>
                <ActionButton
                  icon={canResume ? <Play className="size-3.5" fill="currentColor" /> : <Pause className="size-3.5" />}
                  disabled={(!canPause && !canResume) || isActionPending}
                  loading={actions.pause.isPending || actions.resume.isPending}
                  onClick={() => (canResume ? actions.resume.mutate() : actions.pause.mutate())}
                >
                  {canResume ? "Resume" : "Pause"}
                </ActionButton>
                <ActionButton
                  icon={<RotateCcw className="size-3.5" />}
                  disabled={!canReset || isActionPending}
                  loading={actions.reset.isPending}
                  onClick={() => actions.reset.mutate()}
                >
                  Reset
                </ActionButton>
                <ActionButton
                  tone="danger"
                  icon={<Square className="size-3" fill="currentColor" />}
                  disabled={!canStop || isActionPending}
                  loading={actions.stop.isPending}
                  onClick={() => actions.stop.mutate()}
                >
                  Stop
                </ActionButton>
              </div>

              <div className="mt-5 flex items-center justify-between border-t border-white/8 pt-4 text-xs">
                <span className="flex items-center gap-2 text-white/45">
                  <Wifi className="size-3.5" />
                  Browser renderer
                </span>
                <span className="flex items-center gap-1.5 text-emerald-200/80">
                  <Check className="size-3.5" />
                  {scene ? "Scene loaded" : "Awaiting scene"}
                </span>
              </div>
            </aside>
          </div>

          <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
            <div className="max-w-md rounded-2xl border border-white/8 bg-[#0a1815]/62 px-4 py-3 backdrop-blur-xl">
              <div className="flex items-center gap-2 text-[10px] font-medium uppercase tracking-[0.2em] text-white/40">
                <Timer className="size-3.5" />
                Tracking camera
              </div>
              <p className="mt-2 text-sm text-white/70">MuJoCo body transforms are streamed into the Three.js scene.</p>
              <p className="mt-2 text-[11px] text-white/35">Drag to orbit · Shift-drag to pan · Scroll to zoom</p>
            </div>

            <div className="grid grid-cols-2 gap-x-7 gap-y-4 rounded-2xl border border-white/8 bg-[#0a1815]/62 px-5 py-4 backdrop-blur-xl sm:grid-cols-4">
              <Metric label="Interval spikes" value={event ? event.spike_count.toLocaleString() : "—"} accent="text-amber-200" />
              <Metric label="Active neurons" value={event ? event.active_neuron_count.toLocaleString() : "—"} accent="text-cyan-200" />
              <Metric label="Total spikes" value={event ? event.total_spike_count.toLocaleString() : "—"} accent="text-white" />
              <Metric label="API" value={health.isSuccess ? "Online" : "Waiting"} accent={health.isSuccess ? "text-emerald-200" : "text-white/60"} />
            </div>
          </div>
        </div>

        {(status.isError || actionError || event?.status === "error") && (
          <div className="absolute bottom-6 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-rose-300/20 bg-rose-950/70 px-4 py-2 text-xs text-rose-100 backdrop-blur-xl">
            <Activity className="size-3.5" />
            {simulation?.error ?? (actionError instanceof Error ? actionError.message : "Simulation needs attention")}
          </div>
        )}

        <div className="pointer-events-none absolute bottom-4 left-6 z-10 hidden items-center gap-2 text-[10px] uppercase tracking-[0.18em] text-white/25 sm:flex lg:left-12">
          <Brain className="size-3.5" />
          <span>MaleCNS / browser viewport</span>
          <CircleStop className="ml-2 size-3" />
          <span>Updated {formatUpdatedAt(event?.updated_at ?? simulation?.updated_at)}</span>
        </div>
      </main>
    </div>
  );
}
