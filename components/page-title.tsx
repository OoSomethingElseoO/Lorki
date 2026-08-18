import type { ReactNode } from "react";

type PageTitleProps = {
  children: ReactNode;
};

export function PageTitle({ children }: PageTitleProps) {
  return (
    <header className="page-title">
      <h1>{children}</h1>
    </header>
  );
}
