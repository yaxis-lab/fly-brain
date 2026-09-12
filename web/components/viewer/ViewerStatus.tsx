interface ViewerStatusProps {
  readonly isLoading: boolean;
  readonly errorMessage: string | null;
}

export function ViewerStatus({ isLoading, errorMessage }: ViewerStatusProps) {
  if (!isLoading && !errorMessage) {
    return null;
  }

  const message = errorMessage
    ? `CNS loading failed: ${errorMessage}`
    : "Loading CNS meshes...";

  return (
    <div className="absolute top-3 left-3 px-2 py-3 border pointer-events-none">
      {message}
    </div>
  );
}
