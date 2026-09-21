import { LoaderCircle } from "lucide-react";
import { cn } from "@/utils/cn";

export function ActionButton({
  children,
  disabled,
  loading,
  onClick,
  tone = "quiet",
  icon,
}: {
  children: React.ReactNode;
  disabled?: boolean;
  loading?: boolean;
  onClick: () => void;
  tone?: "primary" | "quiet" | "danger";
  icon: React.ReactNode;
}) {
  return (
    <button
      type="button"
      disabled={disabled || loading}
      onClick={onClick}
      className={cn(
        "inline-flex h-11 items-center justify-center gap-2 rounded-xl px-4 text-sm font-semibold",
        "transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-teal-500/40",
        "disabled:cursor-not-allowed disabled:opacity-40",
        tone === "primary" &&
          "bg-[#163c3b] text-white shadow-[0_8px_20px_-10px_rgba(22,60,59,0.8)] hover:bg-[#1d4f4c]",
        tone === "quiet" &&
          "border border-slate-200 bg-white text-slate-700 shadow-sm hover:border-slate-300 hover:bg-slate-50",
        tone === "danger" &&
          "border border-rose-200 bg-rose-50 text-rose-700 hover:border-rose-300 hover:bg-rose-100",
      )}
    >
      {loading ? <LoaderCircle className="size-4 animate-spin" /> : icon}
      {children}
    </button>
  );
}
