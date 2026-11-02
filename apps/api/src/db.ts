import { createClient } from "@supabase/supabase-js";

import type { Database } from "@ww/types";

import { env } from "./env.js";

export const db = createClient<Database>(
  env.supabaseUrl,
  env.supabaseSecretKey,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  },
);
