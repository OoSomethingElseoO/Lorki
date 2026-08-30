"use client";

import { createContext, forwardRef, useContext, useId, useState, type ButtonHTMLAttributes, type HTMLAttributes, type KeyboardEvent, type ReactNode } from "react";
import { cn } from "@/lib/utils";

// Plain accessible tabs primitive — no external dependency (this project
// doesn't have Radix or shadcn's tabs installed). Follows the WAI-ARIA
// Authoring Practices "Tabs" pattern: role="tablist"/"tab"/"tabpanel",
// aria-selected, a roving tabindex (only the active tab is in the normal
// Tab-key sequence, the rest are -1), and Left/Right/Home/End arrow-key
// navigation that moves focus AND activates the tab (single-select,
// automatic-activation variant of the pattern).
//
// Inactive <TabsContent> panels stay mounted in the DOM (hidden via the
// `hidden` attribute, not conditionally rendered away) — see TabsContent's
// own comment for why that matters for a <form> spanning multiple tabs.

type TabsContextValue = {
  value: string;
  setValue: (value: string) => void;
  idPrefix: string;
};

const TabsContext = createContext<TabsContextValue | null>(null);

function useTabsContext(component: string): TabsContextValue {
  const ctx = useContext(TabsContext);
  if (!ctx) {
    throw new Error(`<${component}> must be rendered inside <Tabs>`);
  }
  return ctx;
}

export type TabsProps = {
  /** Initial active tab value (uncontrolled). Ignored once `value` is passed. */
  defaultValue?: string;
  /** Active tab value, for a controlled instance. */
  value?: string;
  /** Fires with the newly-selected tab's value, controlled or not. */
  onValueChange?: (value: string) => void;
  className?: string;
  children: ReactNode;
};

/** Root — wrap one <TabsList> of <TabsTrigger>s plus one <TabsContent> per
 *  tab (matched by `value`). Uncontrolled by default; pass `value` +
 *  `onValueChange` to drive it from outside. */
export function Tabs({ defaultValue, value: controlledValue, onValueChange, className, children }: TabsProps) {
  const [uncontrolledValue, setUncontrolledValue] = useState(defaultValue ?? "");
  const idPrefix = useId();
  const value = controlledValue ?? uncontrolledValue;

  function setValue(next: string) {
    if (controlledValue === undefined) {
      setUncontrolledValue(next);
    }
    onValueChange?.(next);
  }

  return (
    <TabsContext.Provider value={{ value, setValue, idPrefix }}>
      <div className={className}>{children}</div>
    </TabsContext.Provider>
  );
}

export type TabsListProps = HTMLAttributes<HTMLDivElement> & {
  "aria-label": string;
};

const ARROW_KEYS = new Set(["ArrowLeft", "ArrowRight", "Home", "End"]);

/** The row of tab buttons. Handles keyboard navigation: Left/Right move
 *  focus (and activate) the previous/next enabled tab, wrapping at the
 *  ends; Home/End jump to the first/last. */
export const TabsList = forwardRef<HTMLDivElement, TabsListProps>(({ className, children, onKeyDown, ...props }, ref) => {
  const { setValue } = useTabsContext("TabsList");

  function handleKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    onKeyDown?.(event);
    if (event.defaultPrevented || !ARROW_KEYS.has(event.key)) return;

    const list = event.currentTarget;
    const tabs = Array.from(list.querySelectorAll<HTMLButtonElement>('[role="tab"]:not(:disabled)'));
    if (tabs.length === 0) return;

    const currentIndex = tabs.indexOf(document.activeElement as HTMLButtonElement);
    let nextIndex = currentIndex;
    if (event.key === "ArrowRight") nextIndex = currentIndex < 0 ? 0 : (currentIndex + 1) % tabs.length;
    else if (event.key === "ArrowLeft") nextIndex = currentIndex < 0 ? 0 : (currentIndex - 1 + tabs.length) % tabs.length;
    else if (event.key === "Home") nextIndex = 0;
    else if (event.key === "End") nextIndex = tabs.length - 1;

    event.preventDefault();
    const nextTab = tabs[nextIndex];
    nextTab.focus();
    const nextValue = nextTab.dataset.value;
    if (nextValue) setValue(nextValue);
  }

  return (
    <div ref={ref} role="tablist" className={cn("ui-tabs-list", className)} onKeyDown={handleKeyDown} {...props}>
      {children}
    </div>
  );
});
TabsList.displayName = "TabsList";

export type TabsTriggerProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, "value"> & {
  value: string;
};

export const TabsTrigger = forwardRef<HTMLButtonElement, TabsTriggerProps>(
  ({ value, className, onClick, disabled, ...props }, ref) => {
    const { value: activeValue, setValue, idPrefix } = useTabsContext("TabsTrigger");
    const isActive = value === activeValue;

    return (
      <button
        ref={ref}
        type="button"
        role="tab"
        id={`${idPrefix}-tab-${value}`}
        aria-selected={isActive}
        aria-controls={`${idPrefix}-panel-${value}`}
        tabIndex={isActive ? 0 : -1}
        disabled={disabled}
        data-value={value}
        data-state={isActive ? "active" : "inactive"}
        className={cn("ui-tabs-trigger", className)}
        onClick={(event) => {
          onClick?.(event);
          if (!event.defaultPrevented) setValue(value);
        }}
        {...props}
      />
    );
  },
);
TabsTrigger.displayName = "TabsTrigger";

export type TabsContentProps = HTMLAttributes<HTMLDivElement> & {
  value: string;
};

/** Stays mounted when inactive — hidden via the HTML `hidden` attribute
 *  rather than being conditionally rendered away. Two reasons: it's what
 *  the ARIA APG tabs pattern itself specifies, and it means form fields
 *  living inside every panel remain part of one shared <form>'s submission
 *  regardless of which tab happens to be visible (`hidden` removes an
 *  element from rendering but does NOT exclude its form controls from
 *  FormData/submission — only `disabled` does that) — required for Admin
 *  Settings, where one Save button at the bottom saves fields across all
 *  four tabs at once. */
export const TabsContent = forwardRef<HTMLDivElement, TabsContentProps>(({ value, className, ...props }, ref) => {
  const { value: activeValue, idPrefix } = useTabsContext("TabsContent");
  const isActive = value === activeValue;

  return (
    <div
      ref={ref}
      role="tabpanel"
      id={`${idPrefix}-panel-${value}`}
      aria-labelledby={`${idPrefix}-tab-${value}`}
      hidden={!isActive}
      tabIndex={0}
      className={cn("ui-tabs-content", className)}
      {...props}
    />
  );
});
TabsContent.displayName = "TabsContent";
