import { HttpStatus, Inject, Injectable } from '@nestjs/common';
import { and, asc, between, eq, or, sql } from 'drizzle-orm';

import { AppException, ErrorCode, notFound } from '../../common/errors';
import { DB, type Database } from '../../database/database.module';
import { cities, countries, states } from '../../database/schema';
import type { CountryDto, NearestLocationDto } from './dto/locations.dto';

// further than this and the closest loaded city is the wrong answer (e.g. someone in Japan)
const MAX_NEAREST_KM = 150;
const KM_PER_DEGREE = 111.2;

@Injectable()
export class LocationsService {
  constructor(@Inject(DB) private readonly db: Database) { }

  countries(): Promise<CountryDto[]> {
    return this.db.select({ code: countries.code, name: countries.name }).from(countries).orderBy(asc(countries.name));
  }

  async states(country: string): Promise<string[]> {
    const { id } = await this.findCountry(country);
    const rows = await this.db
      .select({ name: states.name })
      .from(states)
      .where(eq(states.countryId, id))
      .orderBy(asc(states.name));
    return rows.map((r) => r.name);
  }

  async cities(country: string, state: string): Promise<string[]> {
    const { id: countryId } = await this.findCountry(country);
    const [found] = await this.db
      .select({ id: states.id })
      .from(states)
      .where(and(eq(states.countryId, countryId), sql`lower(${states.name}) = ${state.trim().toLowerCase()}`))
      .limit(1);
    if (!found) throw notFound('State');

    const rows = await this.db
      .select({ name: cities.name })
      .from(cities)
      .where(eq(cities.stateId, found.id))
      .orderBy(asc(cities.name));
    return rows.map((r) => r.name);
  }

  /** Closest loaded city to a point, or 404 LOCATION_NOT_SUPPORTED if none is within range. */
  async nearest(lat: number, lng: number): Promise<NearestLocationDto> {
    // cheap box around the point first, then exact distance on the few cities left
    const dLat = MAX_NEAREST_KM / KM_PER_DEGREE;
    const cosLat = Math.cos((lat * Math.PI) / 180);
    const dLng = cosLat > 0.01 ? dLat / cosLat : 180;

    const km = sql<number>`6371 * 2 * asin(least(1, sqrt(
      power(sin(radians(${cities.latitude} - ${lat}::float8) / 2), 2) +
      cos(radians(${lat}::float8)) * cos(radians(${cities.latitude})) *
      power(sin(radians(${cities.longitude} - ${lng}::float8) / 2), 2)
    )))`;

    const [row] = await this.db
      .select({
        city: cities.name,
        state: states.name,
        country: countries.name,
        countryCode: countries.code,
        distanceKm: km,
      })
      .from(cities)
      .innerJoin(states, eq(states.id, cities.stateId))
      .innerJoin(countries, eq(countries.id, states.countryId))
      .where(and(between(cities.latitude, lat - dLat, lat + dLat), between(cities.longitude, lng - dLng, lng + dLng)))
      .orderBy(km)
      .limit(1);

    if (!row || row.distanceKm > MAX_NEAREST_KM) {
      throw new AppException(
        HttpStatus.NOT_FOUND,
        ErrorCode.LOCATION_NOT_SUPPORTED,
        'No supported city near this location',
      );
    }
    return { ...row, distanceKm: Math.round(row.distanceKm * 10) / 10 };
  }

  /**
   * Canonical names when this country, state and city exist together, otherwise null.
   * The country can be a code or a name, everything is matched in any letter case.
   */
  async resolve(country: string, state: string, city: string) {
    const value = country.trim();
    const [row] = await this.db
      .select({ country: countries.name, state: states.name, city: cities.name })
      .from(cities)
      .innerJoin(states, eq(states.id, cities.stateId))
      .innerJoin(countries, eq(countries.id, states.countryId))
      .where(
        and(
          or(eq(countries.code, value.toUpperCase()), sql`lower(${countries.name}) = ${value.toLowerCase()}`),
          sql`lower(${states.name}) = ${state.trim().toLowerCase()}`,
          sql`lower(${cities.name}) = ${city.trim().toLowerCase()}`,
        ),
      )
      .limit(1);
    return row ?? null;
  }

  /** The profile stores names, so accept the code or the name in any case. */
  private async findCountry(input: string) {
    const value = input.trim();
    const [row] = await this.db
      .select({ id: countries.id, code: countries.code, name: countries.name })
      .from(countries)
      .where(or(eq(countries.code, value.toUpperCase()), sql`lower(${countries.name}) = ${value.toLowerCase()}`))
      .limit(1);
    if (!row) throw notFound('Country');
    return row;
  }
}