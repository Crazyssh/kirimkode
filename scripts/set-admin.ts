// Script untuk set user jadi admin
// Jalankan: npx tsx scripts/set-admin.ts

import "dotenv/config";
import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is not set");

const adapter = new PrismaPg({ connectionString });
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
