"use client";

import { useState } from "react";
import {
  Activity,
  AlertCircle,
  Check,
  CircleStop,
  Clock3,
  Eye,
  Gauge,
  Pause,
  Play,
  Radio,
  RefreshCw,
  RotateCcw,
  Server,
  Sparkles,
  Square,
  TimerReset,
} from "lucide-react";

import { Sidebar } from "@/components/layout/Sidebar";
import { useSimulation } from "@/hooks/useSimulation";
import { cn } from "@/utils/cn";
import { stateMeta, transitionStates } from "@/utils/simulations/state";
import { formatSimulationTime, formatUpdatedAt } from "@/utils/formats";
import { ActionButton } from "../layout/ActionButton";
import { StatusBadge } from "../layout/StatusBadge";

export function SimulationDashboard() {
  const [visualization, setVisualization] = useState(false);
  const { health, status, actions, isActionPending } = useSimulation();
  const simulation = status.data;
  const state = simulation?.state ?? "idle";
  const meta = stateMeta[state];
  const isTransitioning = transitionStates.has(state);
  const canStart =
    Boolean(simulation) && ["idle", "stopped", "error"].includes(state);
  const canPause = state === "running";
  const canResume = state === "paused";
  const canReset = state === "running" || state === "paused";
  const canStop = ["starting", "running", "paused", "resetting"].includes(
    state,
  );
  const backendOnline = health.isSuccess;
  const actionError =
    actions.start.error ??
    actions.pause.error ??
    actions.resume.error ??
    actions.reset.error ??
    actions.stop.error;

  return (
    <div className="min-h-dvh bg-[#f4f6f7] text-slate-900">
      <Sidebar />

      <main className="relative min-h-dvh overflow-hidden pl-17">
        <div className="pointer-events-none absolute inset-x-0 top-0 h-72 bg-[radial-gradient(circle_at_76%_0%,rgba(93,180,166,0.2),transparent_46%),radial-gradient(circle_at_30%_0%,rgba(216,226,235,0.7),transparent_42%)]" />

        <div className="relative mx-auto max-w-360 px-5 py-6 sm:px-8 lg:px-12 lg:py-9">
          <header className="flex flex-col gap-6 border-b border-slate-200/80 pb-7 md:flex-row md:items-end md:justify-between">
            <div className="max-w-2xl">
              <div className="mb-4 flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.2em] text-teal-700">
                <Sparkles className="size-3.5" />
                Male CNS / Simulation lab
              </div>
              <h1 className="text-3xl font-medium tracking-[-0.04em] text-slate-950 sm:text-4xl">
                A clear window into the runtime.
              </h1>
              <p className="mt-3 max-w-xl text-sm leading-6 text-slate-500 sm:text-[15px]">
                Start a controlled MaleCNS session, watch its lifecycle, and
                keep the current state close at hand.
              </p>
            </div>

            <div className="flex items-center gap-3 self-start md:self-auto">
              <div className="flex items-center gap-2 rounded-full border border-slate-200/80 bg-white/75 px-3 py-2 text-xs font-medium text-slate-500">
                <span
                  className={cn(
                    "size-2 rounded-full",
                    backendOnline ? "bg-emerald-500" : "bg-slate-300",
                  )}
                />
                {backendOnline ? "API online" : "Connecting to API"}
              </div>
              <StatusBadge state={state} />
            </div>
          </header>

          <div className="mt-7 grid gap-5 xl:grid-cols-[minmax(0,1.45fr)_minmax(360px,0.75fr)]">
            <section className="overflow-hidden rounded-3xl border border-slate-200/80 bg-white shadow-[0_24px_60px_-44px_rgba(15,23,42,0.45)]">
              <div className="flex items-center justify-between border-b border-slate-100 px-6 py-5 sm:px-8">
                <div className="flex items-center gap-3">
                  <div className="flex size-10 items-center justify-center rounded-2xl bg-teal-50 text-teal-700">
                    <Activity className="size-5" strokeWidth={1.8} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-slate-900">
                      Runtime overview
                    </p>
                    <p className="mt-0.5 text-xs text-slate-400">
                      Live lifecycle telemetry
                    </p>
                  </div>
                </div>
                <div className="hidden items-center gap-2 text-[11px] font-medium uppercase tracking-[0.15em] text-slate-400 sm:flex">
                  <Radio
                    className={cn(
                      "size-3.5",
                      state === "running" && "text-emerald-500",
                    )}
                  />
                  {isTransitioning ? "Transitioning" : "Control plane"}
                </div>
              </div>

              <div className="px-6 pb-7 pt-8 sm:px-8 sm:pb-9 sm:pt-10">
                <div className="flex flex-col justify-between gap-8 sm:flex-row sm:items-end">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
                      Simulation time
                    </p>
                    <p className="mt-3 font-mono text-5xl font-medium tracking-[-0.06em] text-slate-950 sm:text-6xl">
                      {formatSimulationTime(simulation?.simulation_time)}
                    </p>
                  </div>
                  <div className="max-w-xs sm:text-right">
                    <p className={cn("text-lg font-medium", meta.color)}>
                      {meta.label}
                    </p>
                    <p className="mt-1 text-sm leading-5 text-slate-500">
                      {meta.description}
                    </p>
                  </div>
                </div>

                <div className="mt-10 h-2 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-700",
                      state === "running" && "w-3/5 bg-teal-500",
                      state === "paused" && "w-2/5 bg-sky-400",
                      state === "error" && "w-1/5 bg-rose-400",
                      ["starting", "resetting", "stopping"].includes(state) &&
                        "w-1/3 animate-pulse bg-violet-400",
                      ["idle", "stopped"].includes(state) &&
                        "w-1/12 bg-slate-300",
                    )}
                  />
                </div>

                <div className="mt-5 flex flex-col gap-2 text-xs text-slate-400 sm:flex-row sm:items-center sm:justify-between">
                  <span>
                    {simulation?.message ?? "Waiting for the simulation API"}
                  </span>
                  <span className="flex items-center gap-1.5 whitespace-nowrap">
                    <Clock3 className="size-3.5" />
                    Updated {formatUpdatedAt(simulation?.updated_at)}
                  </span>
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200/80 bg-[#fbfcfc] p-6 shadow-[0_24px_60px_-44px_rgba(15,23,42,0.35)] sm:p-7">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Command surface
                  </p>
                  <p className="mt-1 text-xs leading-5 text-slate-400">
                    Lifecycle controls for the active worker.
                  </p>
                </div>
                <Gauge className="size-5 text-slate-300" strokeWidth={1.7} />
              </div>

              <div className="mt-6 grid gap-3">
                <ActionButton
                  tone="primary"
                  icon={<Play className="size-4" fill="currentColor" />}
                  disabled={!canStart || isActionPending || status.isLoading}
                  loading={actions.start.isPending}
                  onClick={() => actions.start.mutate(visualization)}
                >
                  Start simulation
                </ActionButton>

                <div className="grid grid-cols-2 gap-3">
                  <ActionButton
                    icon={
                      canResume ? (
                        <Play className="size-4" fill="currentColor" />
                      ) : (
                        <Pause className="size-4" />
                      )
                    }
                    disabled={(!canPause && !canResume) || isActionPending}
                    loading={
                      actions.pause.isPending || actions.resume.isPending
                    }
                    onClick={() =>
                      canResume
                        ? actions.resume.mutate()
                        : actions.pause.mutate()
                    }
                  >
                    {canResume ? "Resume" : "Pause"}
                  </ActionButton>
                  <ActionButton
                    icon={<RotateCcw className="size-4" />}
                    disabled={!canReset || isActionPending}
                    loading={actions.reset.isPending}
                    onClick={() => actions.reset.mutate()}
                  >
                    Reset
                  </ActionButton>
                </div>

                <ActionButton
                  tone="danger"
                  icon={<Square className="size-3.5" fill="currentColor" />}
                  disabled={!canStop || isActionPending}
                  loading={actions.stop.isPending}
                  onClick={() => actions.stop.mutate()}
                >
                  Stop simulation
                </ActionButton>
              </div>

              <div className="mt-7 border-t border-slate-200/80 pt-5">
                <button
                  type="button"
                  aria-pressed={visualization}
                  disabled={!canStart || isActionPending}
                  onClick={() => setVisualization((value) => !value)}
                  className="group flex w-full items-center justify-between gap-4 text-left disabled:cursor-not-allowed disabled:opacity-50"
                >
                  <span className="flex items-center gap-3">
                    <span
                      className={cn(
                        "flex size-9 items-center justify-center rounded-xl transition-colors",
                        visualization
                          ? "bg-violet-100 text-violet-700"
                          : "bg-slate-100 text-slate-400",
                      )}
                    >
                      <Eye className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-medium text-slate-700">
                        Development viewer
                      </span>
                      <span className="mt-0.5 block text-xs text-slate-400">
                        Enable visual output on start
                      </span>
                    </span>
                  </span>
                  <span
                    className={cn(
                      "relative h-6 w-11 rounded-full p-1 transition-colors",
                      visualization ? "bg-violet-500" : "bg-slate-200",
                    )}
                  >
                    <span
                      className={cn(
                        "block size-4 rounded-full bg-white shadow-sm transition-transform",
                        visualization && "translate-x-5",
                      )}
                    />
                  </span>
                </button>
              </div>
            </section>
          </div>

          <div className="mt-5 grid gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
            <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <Server className="size-4" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Backend connection
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    FastAPI control plane
                  </p>
                </div>
              </div>
              <div className="mt-6 flex items-end justify-between gap-5">
                <div>
                  <p className="text-2xl font-medium tracking-tight text-slate-900">
                    {backendOnline
                      ? "Operational"
                      : health.isError
                        ? "Unavailable"
                        : "Checking"}
                  </p>
                  <p className="mt-1 text-xs text-slate-400">
                    {health.data?.service ?? "fly-brain-api"}
                    {health.data?.version ? ` · v${health.data.version}` : ""}
                  </p>
                </div>
                <div
                  className={cn(
                    "flex size-10 items-center justify-center rounded-full",
                    backendOnline
                      ? "bg-emerald-50 text-emerald-600"
                      : "bg-slate-100 text-slate-400",
                  )}
                >
                  {backendOnline ? (
                    <Check className="size-5" />
                  ) : (
                    <RefreshCw className="size-4" />
                  )}
                </div>
              </div>
            </section>

            <section className="rounded-3xl border border-slate-200/80 bg-white/80 p-6 sm:p-7">
              <div className="flex items-center gap-3">
                <div className="flex size-9 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                  <TimerReset className="size-4" strokeWidth={1.8} />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-900">
                    Session details
                  </p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    Current runtime context
                  </p>
                </div>
              </div>
              <div className="mt-6 grid grid-cols-2 gap-5">
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Started
                  </p>
                  <p className="mt-2 text-sm font-medium text-slate-700">
                    {formatUpdatedAt(simulation?.started_at ?? undefined)}
                  </p>
                </div>
                <div>
                  <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">
                    Mode
                  </p>
                  <p className="mt-2 flex items-center gap-1.5 text-sm font-medium text-slate-700">
                    <Eye className="size-3.5 text-slate-400" />
                    {visualization ? "Viewer enabled" : "Headless"}
                  </p>
                </div>
              </div>
            </section>
          </div>

          {(status.isError || actionError || simulation?.error) && (
            <div className="mt-5 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3.5 text-sm text-rose-800">
              <AlertCircle className="mt-0.5 size-4 shrink-0" />
              <div>
                <p className="font-semibold">Simulation API needs attention</p>
                <p className="mt-1 text-rose-700">
                  {simulation?.error ??
                    (actionError instanceof Error
                      ? actionError.message
                      : "Unable to reach the simulation backend.")}
                </p>
              </div>
            </div>
          )}

          <footer className="mt-8 flex items-center gap-2 text-xs text-slate-400">
            <CircleStop className="size-3.5" />
            Commands are sent to the local MaleCNS runtime.
          </footer>
        </div>
      </main>
    </div>
  );
}
