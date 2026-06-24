// Seeds one known host account so there's always a guaranteed login,
// independent of the mocked SSO (which also lets any email sign in as host).
// Idempotent: safe to run on every deploy/restart.
import "dotenv/config";
import { PrismaClient } from "../app/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";
import bcrypt from "bcryptjs";

const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || "file:./prisma/dev.db",
});
const prisma = new PrismaClient({ adapter });

const DEMO_EMAIL = "host@loom.demo";
const DEMO_PASSWORD = "LoomDemo2026!";

async function main() {
  const passwordHash = await bcrypt.hash(DEMO_PASSWORD, 10);
  const user = await prisma.user.upsert({
    where: { email: DEMO_EMAIL },
    update: {}, // never clobber an existing user's password
    create: {
      email: DEMO_EMAIL,
      password: passwordHash,
      displayName: "Demo Host",
      role: "host",
      isGuest: false,
    },
  });
  console.log(`Seeded host login: ${user.email} (password: ${DEMO_PASSWORD})`);
}

main()
  .catch((e) => {
    console.error("Seed failed:", e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
