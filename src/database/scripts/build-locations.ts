import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { gzipSync } from 'node:zlib';

/**
 * Rebuilds src/database/data/locations.json.gz from the open countries-states-cities database
 * (ODbL, https://github.com/dr5hn/countries-states-cities-database). Needs internet, ~50 MB download.
 * Edit COUNTRY_CODES, run `npm run db:build-locations`, then `npm run db:seed:locations`.
 */
const COUNTRY_CODES = ['IN', 'US', 'GB', 'DE', 'FR', 'ES', 'IT', 'NL', 'SE', 'PT', 'IE', 'CH'];

const SOURCE =
  'https://raw.githubusercontent.com/dr5hn/countries-states-cities-database/master/json/countries%2Bstates%2Bcities.json';

type Source = {
  name: string;
  iso2: string;
  states: { name: string; iso2: string | null; cities: { name: string; latitude: string; longitude: string }[] }[];
}[];

async function main() {
  const res = await fetch(SOURCE);
  if (!res.ok) throw new Error(`Download failed: ${res.status}`);
  const all = (await res.json()) as Source;

  const output = COUNTRY_CODES.map((code) => {
    const country = all.find((c) => c.iso2 === code);
    if (!country) throw new Error(`Unknown country code ${code}`);

    const states = country.states
      .map((s) => {
        // one entry per city name, and no dead-end states
        const seen = new Set<string>();
        const cities: [string, number, number][] = [];
        for (const c of s.cities) {
          if (seen.has(c.name)) continue;
          seen.add(c.name);
          cities.push([c.name, Number(Number(c.latitude).toFixed(4)), Number(Number(c.longitude).toFixed(4))]);
        }
        return { code: s.iso2 || null, name: s.name, cities };
      })
      .filter((s) => s.cities.length > 0);

    return { code, name: country.name, states };
  });

  const file = resolve(process.cwd(), 'src/database/data/locations.json.gz');
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, gzipSync(JSON.stringify(output)));

  for (const c of output) {
    console.log(`${c.name}: ${c.states.length} states, ${c.states.reduce((n, s) => n + s.cities.length, 0)} cities`);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});