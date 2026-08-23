"use client";

import { useRouter } from "next/navigation";
import { buttonVariants } from "@/components/ui/button";

export function LogoutButton({ className = buttonVariants() }: { className?: string }) {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" className={className} onClick={handleLogout}>
      Log out
    </button>
  );
}
