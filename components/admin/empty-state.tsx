type EmptyStateProps = {
  message: string;
  hint?: string;
};

export function EmptyState({ message, hint }: EmptyStateProps) {
  return (
    <div className="admin-empty-state">
      <svg
        className="admin-empty-state__icon"
        viewBox="0 0 24 24"
        width="32"
        height="32"
        fill="none"
        aria-hidden="true"
      >
        <path
          d="M3 7h18M3 7l1.5 12.2a2 2 0 0 0 2 1.8h11a2 2 0 0 0 2-1.8L21 7M3 7l2-4h14l2 4M9 12h6"
          stroke="currentColor"
          strokeWidth="1.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
      <p className="admin-empty-state__message">{message}</p>
      {hint ? <p className="admin-empty-state__hint">{hint}</p> : null}
    </div>
  );
}
