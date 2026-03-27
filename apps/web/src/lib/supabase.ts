import { createClient } from "@supabase/supabase-js";

const supabaseUrl =
  import.meta.env.VITE_SUPABASE_URL ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_URL ||
  "";
const supabaseAnonKey =
  import.meta.env.VITE_SUPABASE_ANON_KEY ||
  import.meta.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
  "";

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  storageBucket:
    import.meta.env.VITE_SUPABASE_STORAGE_BUCKET ||
    import.meta.env.NEXT_PUBLIC_SUPABASE_STORAGE_BUCKET ||
    "attachments",
  inviteCodeHint:
    import.meta.env.VITE_INVITE_CODE ||
    import.meta.env.NEXT_PUBLIC_INVITE_CODE ||
    "FROST-FRIENDS",
};

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true,
    storageKey: "frostchat-web-auth",
  },
  realtime: {
    params: {
      eventsPerSecond: 10,
    },
  },
});

export function assertSupabaseConfigured() {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    throw new Error(
      "Supabase is not configured. Add VITE_SUPABASE_URL / VITE_SUPABASE_ANON_KEY or NEXT_PUBLIC_SUPABASE_URL / NEXT_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
}
