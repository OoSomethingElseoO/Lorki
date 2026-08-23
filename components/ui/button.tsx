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
  "inline-flex items-center justify-center gap-2 whitespace-nowrap font-[inherit] font-semibold no-underline transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer",
  {
    variants: {
      variant: {
        // The public site's one primary look — dark fill, light text.
        // Matches the old .button-link exactly.
        // text-* uses the ! important modifier throughout this file: this
        // button is sometimes rendered as a <Link>, and globals.css has an
        // unlayered `a { color: inherit; }` reset which — per CSS cascade
        // layers — beats ANY Tailwind utility (Tailwind utilities live in
        // @layer utilities, and unlayered rules always win regardless of
        // specificity/source order) unless forced with !important.
        default: "rounded-none bg-ink text-panel! border-2 border-line hover:bg-[#3a3026] hover:underline",
        // Dashboard/admin form submit buttons — matches the old
        // .admin-form button exactly (a distinct, more neutral look from
        // the public site's .button-link, used inside admin/seller/cause
        // forms regardless of which brand/admin shell they sit in).
        form: "rounded-md bg-admin-text text-admin-bg! border border-admin-text hover:bg-[#33322c] active:translate-y-px",
        // Compact secondary action inside an admin-style table row/card —
        // matches .admin-table__link-button exactly.
        outline: "rounded-none bg-admin-surface text-ink! border border-admin-border hover:bg-admin-hover",
        destructive:
          "rounded-none bg-admin-surface text-error-accent! border border-error-accent hover:bg-error-accent hover:text-admin-surface!",
        ghost: "rounded-none bg-transparent text-ink! border border-transparent hover:bg-admin-hover",
        // For controls that sit directly on the dark persistent sidebar
        // (DashboardShell's logout/theme-toggle) — transparent against the
        // sidebar's own dark background, not against a light page.
        sidebar: "rounded-none bg-transparent text-[#f2f2f0]! border border-white/30 hover:bg-white/10",
        // The site header's translucent icon buttons (search/account/menu/
        // theme-toggle) sitting over the hero image — matches .icon-button
        // exactly. Always pair with size="icon".
        "icon-panel":
          "rounded-none border-2 border-line bg-[color-mix(in_srgb,var(--panel)_82%,transparent)] text-ink! hover:bg-surface",
      },
      size: {
        default: "px-4 py-2.5 text-base",
        sm: "px-3 py-1.5 text-sm",
        icon: "h-12 w-12 p-0",
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
