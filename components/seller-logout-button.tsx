"use client";

import { useRouter } from "next/navigation";

export function SellerLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/seller/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" className="button-link" onClick={handleLogout}>
      Log out
    </button>
  );
}
