type IconProps = { className?: string };

const base = {
  width: 14,
  height: 14,
  viewBox: "0 0 24 24",
  fill: "none",
  "aria-hidden": true as const,
};

export function EditIcon({ className = "admin-icon" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4 12.5-12.5Z"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function TrashIcon({ className = "admin-icon" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M3 6h18M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2m2 0-.8 13.4a2 2 0 0 1-2 1.6H7.8a2 2 0 0 1-2-1.6L5 6h14ZM10 11v6M14 11v6"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CheckIcon({ className = "admin-icon" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path d="m4 12 6 6L20 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

export function RefundIcon({ className = "admin-icon" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M9 8 4 12l5 4M4 12h11a5 5 0 0 1 5 5v1"
        stroke="currentColor"
        strokeWidth="1.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function ShipIcon({ className = "admin-icon" }: IconProps) {
  return (
    <svg {...base} className={className}>
      <path
        d="M3 16V6a1 1 0 0 1 1-1h9v11M3 16h10M3 16v1a1 1 0 0 0 1 1h1m8-2v-6h4l3 3v3h-2m-5 0h5m-5 0a2 2 0 1 1-4 0m4 0a2 2 0 1 0-4 0m9 0a2 2 0 1 1-4 0 2 2 0 0 1 4 0Z"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
