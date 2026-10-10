import { Global, Inject, Logger, Module, OnApplicationShutdown } from '@nestjs/common';
import { drizzle, NodePgDatabase } from 'drizzle-orm/node-postgres';
import { Pool } from 'pg';

import { AppConfig } from '../config/app-config.service';
import * as schema from './schema';

export const DB = Symbol('DB');
export const PG_POOL = Symbol('PG_POOL');

export type Database = NodePgDatabase<typeof schema>;
/** The handle passed to `db.transaction(async (tx) => …)`. */
export type Transaction = Parameters<Parameters<Database['transaction']>[0]>[0];
/** Anything that can run queries — the root database or an open transaction. */
export type DbExecutor = Database | Transaction;

@Global()
@Module({
  providers: [
    {
      provide: PG_POOL,
      inject: [AppConfig],
      useFactory: (config: AppConfig) =>
        new Pool({ connectionString: config.get('DATABASE_URL'), max: 10 }),
    },
    {
      provide: DB,
      inject: [PG_POOL],
      /** Set DB_LOG=true to print every SQL statement. */
      useFactory: (pool: Pool): Database =>
        drizzle({ client: pool, schema, logger: process.env.DB_LOG === 'true' }),
    },
  ],
  exports: [DB, PG_POOL],
})
export class DatabaseModule implements OnApplicationShutdown {
  private readonly logger = new Logger(DatabaseModule.name);

  constructor(@Inject(PG_POOL) private readonly pool: Pool) {}

  async onApplicationShutdown() {
    await this.pool.end();
    this.logger.log('Database pool closed');
  }
}
