"use client";

import { useRouter } from "next/navigation";

export function AccountLogoutButton() {
  const router = useRouter();

  async function handleLogout() {
    await fetch("/api/account/logout", { method: "POST" });
    router.push("/");
    router.refresh();
  }

  return (
    <button type="button" className="button-link" onClick={handleLogout}>
      Log out
    </button>
  );
}
