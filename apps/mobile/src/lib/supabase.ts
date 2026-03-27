import AsyncStorage from "@react-native-async-storage/async-storage";
import { createClient } from "@supabase/supabase-js";

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL || "";
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || "";

export const supabaseConfig = {
  url: supabaseUrl,
  anonKey: supabaseAnonKey,
  storageBucket: process.env.EXPO_PUBLIC_SUPABASE_STORAGE_BUCKET || "attachments",
  inviteCodeHint: process.env.EXPO_PUBLIC_INVITE_CODE || "FROST-FRIENDS",
};

export const supabase = createClient(supabaseConfig.url, supabaseConfig.anonKey, {
  auth: {
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    storage: AsyncStorage,
    storageKey: "frostchat-mobile-auth",
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
      "Supabase is not configured. Add EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY.",
    );
  }
}
