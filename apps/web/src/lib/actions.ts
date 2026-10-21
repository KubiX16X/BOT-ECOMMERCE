"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { ADMIN_COOKIE, adminPassword, safeEqual, sessionToken } from "./auth";

export async function login(formData: FormData): Promise<void> {
  const password = adminPassword();
  const given = String(formData.get("password") ?? "");
  if (!password || !safeEqual(given, password)) {
    await new Promise((r) => setTimeout(r, 1000)); // spowalnia zgadywanie hasła
    redirect("/admin/login?blad=1");
  }
  (await cookies()).set(ADMIN_COOKIE, sessionToken(password), {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    maxAge: 60 * 60 * 24 * 30,
    path: "/",
  });
  redirect("/admin");
}

export async function logout(): Promise<void> {
  (await cookies()).delete(ADMIN_COOKIE);
  redirect("/admin/login");
}
