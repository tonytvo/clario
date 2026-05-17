/**
 * Supabase client factory.
 *
 * createServiceClient() — for server-side queries with full access.
 * createUserClient(jwt) — RLS-scoped to the authenticated user.
 *
 * RLS does the heavy lifting: users can only see their own groups/expenses.
 * We never need to manually filter by user_id in most queries.
 */

import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
  throw new Error(
    "Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables."
  );
}

// Service client — bypasses RLS (used only for admin ops)
export function createServiceClient() {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: { persistSession: false },
  });
}

// User client — RLS scoped to the JWT user
export function createUserClient(jwt: string) {
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
    global: {
      headers: { Authorization: `Bearer ${jwt}` },
    },
  });
}

// Extract user ID from JWT without verifying (Supabase verifies on the DB side)
export function getUserIdFromJwt(jwt: string): string {
  try {
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString("utf8")
    );
    if (!payload.sub) throw new Error("No sub claim in JWT");
    return payload.sub as string;
  } catch {
    throw new Error("Invalid JWT — could not extract user ID");
  }
}
