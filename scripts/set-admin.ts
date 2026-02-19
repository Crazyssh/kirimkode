// Script untuk set user jadi admin
// Jalankan: npx tsx scripts/set-admin.ts

import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaBetterSqlite3 } from "@prisma/adapter-better-sqlite3";

const adapter = new PrismaBetterSqlite3({ url: "./dev.db" });
const db = new PrismaClient({ adapter });

async function main() {
  const email = "admin@kirimkode.id";

  const user = await db.user.update({
    where: { email },
    data: { role: "admin" },
  });

  console.log(`✅ User "${user.name}" (${user.email}) sekarang role: ${user.role}`);

  // Tampilkan semua users
  const allUsers = await db.user.findMany({
    select: { id: true, name: true, email: true, role: true, balance: true },
  });
  console.table(allUsers);
}

main()
  .catch(console.error)
  .finally(() => db.$disconnect());
