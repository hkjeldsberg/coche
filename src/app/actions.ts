"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { db, type PrefsRow } from "@/lib/db";
import { resolveLevels } from "@/lib/features";
import { SESSION_COOKIE, SESSION_TTL_MS, checkPassword, createSessionToken, verifySessionToken } from "@/lib/session";

async function requireAuth() {
  const jar = await cookies();
  if (!(await verifySessionToken(jar.get(SESSION_COOKIE)?.value))) throw new Error("unauthorized");
}

export async function login(formData: FormData) {
  const password = String(formData.get("password") ?? "");
  if (!(await checkPassword(password))) redirect("/login?error=1");
  const jar = await cookies();
  jar.set(SESSION_COOKIE, await createSessionToken(), {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: SESSION_TTL_MS / 1000,
  });
  redirect("/");
}

export async function logout() {
  (await cookies()).delete(SESSION_COOKIE);
  redirect("/login");
}

const clampInt = (v: unknown, min: number, max: number, fallback: number) => {
  const n = Math.round(Number(v));
  return Number.isFinite(n) ? Math.min(max, Math.max(min, n)) : fallback;
};

export async function savePrefs(p: PrefsRow) {
  await requireAuth();
  const row = {
    id: 1,
    max_price_nok: clampInt(p.max_price_nok, 350_000, 700_000, 600_000),
    max_mileage_km: clampInt(p.max_mileage_km, 0, 120_000, 50_000),
    min_wltp_km: clampInt(p.min_wltp_km, 0, 600, 500),
    drivetrain: (["all", "awd", "rwd"] as const).includes(p.drivetrain) ? p.drivetrain : "all",
    sort: (["score", "price", "newest", "drop"] as const).includes(p.sort) ? p.sort : "score",
    feature_levels: resolveLevels(p.feature_levels),
    updated_at: new Date().toISOString(),
  };
  const { error } = await db().from("user_preferences").upsert(row);
  if (error) throw new Error(error.message);
}

export async function setListingFlag(id: string, flag: "is_favorite" | "is_hidden", value: boolean) {
  await requireAuth();
  if (flag !== "is_favorite" && flag !== "is_hidden") throw new Error("bad flag");
  const { error } = await db().from("listings").update({ [flag]: Boolean(value) }).eq("id", id);
  if (error) throw new Error(error.message);
  revalidatePath("/");
}
