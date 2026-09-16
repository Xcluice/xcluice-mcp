import { createClient } from "@supabase/supabase-js";

// "We learn" project (lnhomkdmbcbfpathdyvo) — not connected to the main
// Xcluice app; used here as a standalone backend for this MCP server.
const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceRoleKey) {
  // Thrown at request time inside route handlers, not at build time,
  // since env vars are only guaranteed to exist once deployed on Vercel
  // with the correct project settings.
  console.warn(
    "SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY is not set. Supabase calls will fail until these are configured."
  );
}

// Server-side only client. Uses the service role key, which bypasses
// Row Level Security. NEVER expose this key or this client to the browser.
export const supabase = createClient(
  supabaseUrl ?? "",
  supabaseServiceRoleKey ?? "",
  {
    auth: { persistSession: false },
  }
);
