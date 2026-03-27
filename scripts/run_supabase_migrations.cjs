const fs = require("fs");
const path = require("path");
const postgres = require("postgres");

async function main() {
  const databaseUrl = process.env.POSTGRES_URL;
  if (!databaseUrl) {
    throw new Error("POSTGRES_URL is required.");
  }

  const migrations = [
    "supabase/migrations/20260326_frostchat_public.sql",
    "supabase/migrations/20260327_frostchat_invite_consumption.sql",
    "supabase/migrations/20260327_frostchat_messages.sql",
    "supabase/migrations/20260327_frostchat_social.sql",
  ];

  const sql = postgres(databaseUrl, { max: 1 });

  try {
    for (const migrationPath of migrations) {
      const absolutePath = path.resolve(process.cwd(), migrationPath);
      const statement = fs.readFileSync(absolutePath, "utf8");
      await sql.unsafe(statement);
      console.log(`Applied ${migrationPath}`);
    }
  } finally {
    await sql.end({ timeout: 5 });
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
