import { doublePrecision, integer, pgTable, text, uniqueIndex } from 'drizzle-orm/pg-core';

/** Country > state > city reference data. Loaded by `npm run db:seed:locations`. */
export const countries = pgTable(
  'countries',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    /** ISO 3166-1 alpha-2, e.g. IN */
    code: text('code').notNull(),
    name: text('name').notNull(),
  },
  (t) => [uniqueIndex('countries_code_key').on(t.code)],
);

export const states = pgTable(
  'states',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    countryId: integer('country_id')
      .notNull()
      .references(() => countries.id, { onDelete: 'cascade' }),
    code: text('code'),
    name: text('name').notNull(),
  },
  (t) => [uniqueIndex('states_country_name_key').on(t.countryId, t.name)],
);

export const cities = pgTable(
  'cities',
  {
    id: integer('id').primaryKey().generatedAlwaysAsIdentity(),
    stateId: integer('state_id')
      .notNull()
      .references(() => states.id, { onDelete: 'cascade' }),
    name: text('name').notNull(),
    latitude: doublePrecision('latitude').notNull(),
    longitude: doublePrecision('longitude').notNull(),
  },
  (t) => [uniqueIndex('cities_state_name_key').on(t.stateId, t.name)],
);