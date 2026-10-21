import { createHmac, timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { loadEnv } from "@revion/core";

export const ADMIN_COOKIE = "revion_admin";

export function adminPassword(): string | undefined {
  loadEnv();
  return process.env.ADMIN_PASSWORD?.trim() || undefined;
}

export function sessionToken(password: string): string {
  return createHmac("sha256", password).update("revion-admin-v1").digest("hex");
}

export function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

export async function isAdmin(): Promise<boolean> {
  // cookies() najpierw – dzięki temu strona panelu zawsze renderuje się na żądanie, a nie przy buildzie.
  const token = (await cookies()).get(ADMIN_COOKIE)?.value;
  const password = adminPassword();
  return !!password && !!token && safeEqual(token, sessionToken(password));
}

export async function requireAdmin(): Promise<void> {
  if (!(await isAdmin())) redirect("/admin/login");
}
