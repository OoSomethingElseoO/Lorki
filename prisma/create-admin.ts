import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { hashPassword } from "@/lib/password";

const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL });
const prisma = new PrismaClient({ adapter });

// Standalone alternative to prisma/seed.ts's admin bootstrap: that one only
// runs at seed time and is meant for a brand-new database. This is for
// adding an admin to a database that already exists (including production)
// without touching anything else in it or needing shell access to the DB —
// `DATABASE_URL=... npx tsx prisma/create-admin.ts <email> <password>`.
async function main() {
  const [email, password] = process.argv.slice(2);

  if (!email || !password) {
    console.error("Usage: DATABASE_URL=... npx tsx prisma/create-admin.ts <email> <password>");
    process.exit(1);
  }

  if (password.length < 8) {
    console.error("Password must be at least 8 characters");
    process.exit(1);
  }

  const normalizedEmail = email.toLowerCase().trim();
  const existing = await prisma.user.findUnique({ where: { email: normalizedEmail } });

  if (existing) {
    if (existing.isAdmin) {
      console.log(`${normalizedEmail} is already an admin — nothing to do.`);
    } else {
      await prisma.user.update({ where: { id: existing.id }, data: { isAdmin: true } });
      console.log(`Promoted existing user ${normalizedEmail} to admin.`);
    }
    return;
  }

  const user = await prisma.user.create({
    data: {
      email: normalizedEmail,
      name: "Admin",
      passwordHash: await hashPassword(password),
      isAdmin: true,
    },
  });

  console.log(`Created admin ${user.email} (id: ${user.id}).`);
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
