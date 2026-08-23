import { cva, type VariantProps } from "class-variance-authority";
import { forwardRef, type ButtonHTMLAttributes } from "react";
import { cn } from "@/lib/utils";

// The design-system entry point for buttons: every variant here maps to a
// visual style that previously lived as its own hand-written CSS class
// scattered across globals.css (.button-link, .admin-table__link-button,
// .admin-delete__button, .dashboard-nav__logout, ...). Changing how any of
// those *kinds* of button look now means editing one variant here, not
// hunting down every place that repeated the same declarations.
export const buttonVariants = cva(
  "inline-flex items-center justify-center gap-2 whitespace-nowrap rounded-none font-semibold transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
  {
    variants: {
      variant: {
        // The site's one true "primary" look — dark fill, light text.
        // Matches .button-link / .admin-form button exactly.
        default: "bg-ink text-panel border-2 border-line hover:bg-[#3a3026]",
        outline: "bg-surface text-ink border border-admin-border hover:bg-admin-hover",
        destructive:
          "bg-surface text-error-accent border border-error-accent hover:bg-error-accent hover:text-surface",
        ghost: "bg-transparent text-ink border border-transparent hover:bg-admin-hover",
        // For controls that sit directly on the dark persistent sidebar
        // (DashboardShell's logout/theme-toggle) — transparent against the
        // sidebar's own dark background, not against a light page.
        sidebar: "bg-transparent text-[#f2f2f0] border border-white/30 hover:bg-white/10",
      },
      size: {
        default: "px-4 py-2.5 text-base",
        sm: "px-3 py-1.5 text-sm",
        icon: "h-11 w-11 p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);

type ButtonProps = ButtonHTMLAttributes<HTMLButtonElement> & VariantProps<typeof buttonVariants>;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, ...props }, ref) => (
    <button ref={ref} className={cn(buttonVariants({ variant, size }), className)} {...props} />
  ),
);
Button.displayName = "Button";
