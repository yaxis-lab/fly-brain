export function formatSimulationTime(value: number | undefined) {
  if (value === undefined) return "--:--.---";

  const totalMilliseconds = Math.max(0, Math.round(value * 1000));
  const milliseconds = totalMilliseconds % 1000;
  const totalSeconds = Math.floor(totalMilliseconds / 1000);
  const seconds = totalSeconds % 60;
  const minutes = Math.floor(totalSeconds / 60);

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(
    2,
    "0",
  )}.${String(milliseconds).padStart(3, "0")}`;
}

export function formatUpdatedAt(value: string | undefined) {
  if (!value) return "Awaiting first status";

  return new Intl.DateTimeFormat("en", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(new Date(value));
}
