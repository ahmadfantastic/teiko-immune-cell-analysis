type LoadingPanelProps = {
  message?: string;
};

type StatusPanelProps = {
  message: string;
};

export function LoadingPanel({
  message = "Updating analysis",
}: LoadingPanelProps) {
  return (
    <div className="state-panel" aria-live="polite">
      <div className="loading-spinner" />
      <p>{message}</p>
    </div>
  );
}

export function ErrorPanel({ message }: StatusPanelProps) {
  return (
    <div className="state-panel error-panel" role="alert">
      <strong>No Matching Data</strong>
      <p>{message}</p>
    </div>
  );
}

export function EmptyPanel({ message }: StatusPanelProps) {
  return (
    <div className="state-panel">
      <p>{message}</p>
    </div>
  );
}
