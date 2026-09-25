import type { ReactNode } from "react";

type EmptyStateProps = {
  icon: ReactNode;
  title: string;
  description: string;
  action?: ReactNode;
  visual?: ReactNode;
};

export function EmptyState({
  icon,
  title,
  description,
  action,
  visual,
}: EmptyStateProps) {
  return (
    <div className="empty-state">
      {visual ? <div className="empty-state__visual">{visual}</div> : null}
      <div className="empty-state__icon" aria-hidden="true">
        {icon}
      </div>
      <h3 className="empty-state__title">{title}</h3>
      <p className="empty-state__description">{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </div>
  );
}
