import 'dotenv/config';

import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { gunzipSync } from 'node:zlib';

import { sql } from 'drizzle-orm';
import { drizzle } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { cities, countries, states } from '../schema';

type Dataset = {
  code: string;
  name: string;
  states: { code: string | null; name: string; cities: [string, number, number][] }[];
}[];

const CHUNK = 5000;

/** Idempotent, safe to run again. Loads the file made by build-locations.ts. */
async function main() {
  const file = resolve(process.cwd(), 'src/database/data/locations.json.gz');
  const data = JSON.parse(gunzipSync(readFileSync(file)).toString('utf8')) as Dataset;

  const pool = new Pool({ connectionString: process.env.DATABASE_URL });
  const db = drizzle(pool);

  try {
    await db.transaction(async (tx) => {
      for (const c of data) {
        const [country] = await tx
          .insert(countries)
          .values({ code: c.code, name: c.name })
          .onConflictDoUpdate({ target: countries.code, set: { name: c.name } })
          .returning({ id: countries.id });

        const stateRows = await tx
          .insert(states)
          .values(c.states.map((s) => ({ countryId: country.id, code: s.code, name: s.name })))
          .onConflictDoUpdate({ target: [states.countryId, states.name], set: { code: sql`excluded.code` } })
          .returning({ id: states.id, name: states.name });
        const stateId = new Map(stateRows.map((r) => [r.name, r.id]));

        const cityRows = c.states.flatMap((s) =>
          s.cities.map(([name, latitude, longitude]) => ({ stateId: stateId.get(s.name)!, name, latitude, longitude })),
        );
        for (let i = 0; i < cityRows.length; i += CHUNK) {
          await tx
            .insert(cities)
            .values(cityRows.slice(i, i + CHUNK))
            .onConflictDoUpdate({
              target: [cities.stateId, cities.name],
              set: { latitude: sql`excluded.latitude`, longitude: sql`excluded.longitude` },
            });
        }
        console.log(`${c.name}: ${c.states.length} states, ${cityRows.length} cities`);
      }
    });
    console.log('Locations seeded');
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});