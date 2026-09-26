"use client";

import Link from "next/link";
import { useState } from "react";
import { Heart, Package, Palette, UserRound, X } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { MfaSettingsModal } from "@/components/mfa-settings-modal";

type AccountActionBarProps = {
  name: string;
  email: string;
  hasArtist: boolean;
  hasConservancy: boolean;
  mfaEnabled: boolean;
};

export function AccountActionBar({ name, email, hasArtist, hasConservancy, mfaEnabled }: AccountActionBarProps) {
  const [open, setOpen] = useState<"account" | "orders" | null>(null);
  const [mfaOpen, setMfaOpen] = useState(false);

  function toggle(panel: "account" | "orders") {
    setOpen((current) => (current === panel ? null : panel));
  }

  return (
    <div className="account-action-bar" aria-label="Account actions">
      <div className="account-action-bar__buttons">
        <Link className={buttonVariants({ variant: "icon-panel", size: "icon" })} href="/originals" aria-label="Browse originals" title="Browse originals">
          <Palette className="size-5" aria-hidden="true" />
        </Link>
        <button type="button" className={buttonVariants({ variant: "icon-panel", size: "icon" })} onClick={() => toggle("orders")} aria-label="View orders" aria-expanded={open === "orders"} title="View orders">
          <Package className="size-5" aria-hidden="true" />
        </button>
        {!hasArtist ? (
          <Link className={buttonVariants({ variant: "icon-panel", size: "icon" })} href="/artist/onboarding" aria-label="Start selling art" title="Start selling art">
            <Heart className="size-5" aria-hidden="true" />
          </Link>
        ) : null}
        {!hasConservancy ? (
          <Link className={buttonVariants({ variant: "icon-panel", size: "icon" })} href="/cause/onboarding" aria-label="Register a conservation cause" title="Register a conservation cause">
            <UserRound className="size-5" aria-hidden="true" />
          </Link>
        ) : null}
        <button type="button" className={buttonVariants({ variant: "icon-panel", size: "icon" })} onClick={() => toggle("account")} aria-label="Open account details" aria-expanded={open === "account"} title="Account details">
          <UserRound className="size-5" aria-hidden="true" />
        </button>
      </div>

      <div className={cn("account-action-popover", open ? "account-action-popover--open" : "")} aria-hidden={!open}>
        {open === "account" ? (
          <div>
            <div className="account-action-popover__header">
              <strong>Account</strong>
              <button type="button" onClick={() => setOpen(null)} aria-label="Close account details"><X className="size-4" /></button>
            </div>
            <p className="account-action-popover__name">{name || "Your account"}</p>
            <p className="account-action-popover__email">{email}</p>
            <button type="button" className="account-action-popover__link" onClick={() => { setOpen(null); setMfaOpen(true); }}>Security &amp; two-step verification</button>
            <Link href="/account" className="account-action-popover__link" onClick={() => setOpen(null)}>Open account dashboard</Link>
          </div>
        ) : null}
        {open === "orders" ? (
          <div>
            <div className="account-action-popover__header">
              <strong>Your orders</strong>
              <button type="button" onClick={() => setOpen(null)} aria-label="Close orders"><X className="size-4" /></button>
            </div>
            <p className="account-action-popover__email">Track purchases and delivery status from your account.</p>
            <Link href="/account#orders" className="account-action-popover__link" onClick={() => setOpen(null)}>View order history</Link>
          </div>
        ) : null}
      </div>
      <MfaSettingsModal open={mfaOpen} onClose={() => setMfaOpen(false)} enabled={mfaEnabled} />
    </div>
  );
}
