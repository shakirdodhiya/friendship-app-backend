import 'dotenv/config';

import { parseArgs } from 'node:util';

import { eq, sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { adminRoleEnum, adminUsers, type AdminRole } from '../../../database/schema';
import { hashPassword } from '../common/password';

/**
 * Creates an admin portal account, or resets the password and role of an existing one.
 *
 *   npm run admin:create -- --email you@example.com --name "Your Name" --password '<at least 10 chars>' [--role super_admin]
 */
async function main() {
  const { values } = parseArgs({
    options: {
      email: { type: 'string' },
      name: { type: 'string' },
      password: { type: 'string' },
      role: { type: 'string', default: 'super_admin' },
    },
  });
  const email = values.email?.trim().toLowerCase();
  const role = values.role as AdminRole;
  if (!email || !values.password) throw new Error('--email and --password are required');
  if (values.password.length < 10) throw new Error('The password must be at least 10 characters');
  if (!adminRoleEnum.enumValues.includes(role)) throw new Error(`--role must be one of ${adminRoleEnum.enumValues.join(', ')}`);

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  try {
    const db = drizzle({ client: pool });
    const passwordHash = await hashPassword(values.password);
    const name = values.name?.trim() || email.split('@')[0];
    const [existing] = await db
      .select({ id: adminUsers.id })
      .from(adminUsers)
      .where(sql`lower(${adminUsers.email}) = ${email}`);
    if (existing) {
      // Resetting also re-enables the account and signs out its sessions.
      await db
        .update(adminUsers)
        .set({ passwordHash, role, disabledAt: null, tokenVersion: sql`${adminUsers.tokenVersion} + 1` })
        .where(eq(adminUsers.id, existing.id));
      console.log(`Updated admin ${email} (${role}): password reset — id ${existing.id}`);
      return;
    }
    const [row] = await db.insert(adminUsers).values({ email, name, role, passwordHash }).returning({ id: adminUsers.id });
    console.log(`Created admin ${email} (${role}) — id ${row.id}`);
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
