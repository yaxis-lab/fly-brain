import { cn } from "@/utils/cn";
import { stateMeta } from "@/utils/simulations/state";
import { SimulationState } from "@/types/simulation";

export function StatusBadge({ state }: { state: SimulationState }) {
  const meta = stateMeta[state];

  return (
    <div
      className={cn(
        "inline-flex items-center gap-2 rounded-full border bg-white/80 px-3 py-1.5",
        "border-slate-200 text-xs font-semibold tracking-wide",
        meta.color,
      )}
    >
      <span className={cn("size-2 rounded-full", meta.dot)} />
      {meta.label}
    </div>
  );
}
