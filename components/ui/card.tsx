import { forwardRef, type HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// Generic card/panel primitive — the piece this codebase was missing.
// Before this, any "boxed content" that wasn't literally an input form
// reached for `.admin-form` (padding/border/shadow styled for input-field
// readability, but hard-capped at `max-width: 36rem`) and then fought that
// cap back off with an inline style. This component extracts the box
// styling from the two visual languages that already exist here —
// `.admin-form`'s neutral internal-tool look and the storefront's
// `.artist-card`/`.artwork-card`/etc. family — without the max-width, so
// callers size it from the outside (a parent grid/flex/className) instead
// of it being baked in.
//
// Two variants, matching the two skins DashboardShell already switches
// between (see components/dashboard-shell.tsx): "admin" for
// `.dashboard-main--admin` contexts (var(--admin-*) tokens), "brand" for
// `.dashboard-main--brand` contexts — seller/cause/account — (var(--line)/
// var(--panel)/the warm elevation shadow). Pick explicitly via the
// `variant` prop, same pattern as components/ui/button.tsx's own variants.

export type CardVariant = "admin" | "brand";
export type CardPadding = "none" | "default" | "lg";

export type CardProps = HTMLAttributes<HTMLDivElement> & {
  /** "admin" (default) = plain internal-tool look, mirrors `.admin-form`'s
   *  own box exactly. "brand" = the storefront card family's look — use
   *  this inside a `dashboard-main--brand` area (seller/cause/account). */
  variant?: CardVariant;
  /** "default" (1.5rem, matches `.admin-form`) | "lg" (2rem) | "none" (let
   *  the content manage its own padding, e.g. a card wrapping a table). */
  padding?: CardPadding;
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  ({ variant = "admin", padding = "default", className, ...props }, ref) => (
    <div
      ref={ref}
      className={cn("ui-card", `ui-card--${variant}`, padding !== "default" && `ui-card--padding-${padding}`, className)}
      {...props}
    />
  ),
);
Card.displayName = "Card";

export type CardHeaderProps = HTMLAttributes<HTMLDivElement>;

/** Title + optional description + optional trailing actions (e.g. a Save
 *  button rendered top-right instead of at the bottom). Lay out extra
 *  children with a bit of `justify-between` flex via className if needed. */
export const CardHeader = forwardRef<HTMLDivElement, CardHeaderProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("ui-card__header", className)} {...props} />
));
CardHeader.displayName = "CardHeader";

export type CardTitleProps = HTMLAttributes<HTMLHeadingElement>;

export const CardTitle = forwardRef<HTMLHeadingElement, CardTitleProps>(({ className, ...props }, ref) => (
  <h2 ref={ref} className={cn("ui-card__title", className)} {...props} />
));
CardTitle.displayName = "CardTitle";

export type CardDescriptionProps = HTMLAttributes<HTMLParagraphElement>;

export const CardDescription = forwardRef<HTMLParagraphElement, CardDescriptionProps>(({ className, ...props }, ref) => (
  <p ref={ref} className={cn("ui-card__description", className)} {...props} />
));
CardDescription.displayName = "CardDescription";

export type CardContentProps = HTMLAttributes<HTMLDivElement>;

/** Plain grouping wrapper for the card's body content — no styling of its
 *  own beyond what CardHeader already spaced off; exists so markup reads
 *  as Header/Content rather than a header dumped next to bare children. */
export const CardContent = forwardRef<HTMLDivElement, CardContentProps>(({ className, ...props }, ref) => (
  <div ref={ref} className={cn("ui-card__content", className)} {...props} />
));
CardContent.displayName = "CardContent";
