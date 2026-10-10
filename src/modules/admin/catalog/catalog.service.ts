import { Inject, Injectable } from '@nestjs/common';
import { asc, eq, getTableColumns, sql } from 'drizzle-orm';

import { conflict, notFound } from '../../../common/errors';
import { DB, type Database } from '../../../database/database.module';
import { coinPacks, payments, proPlans, subscriptions } from '../../../database/schema';
import { AuditService } from '../common/audit.service';
import type { AdminPrincipal } from '../common/types';
import type {
  CoinPackDto,
  CreateCoinPackDto,
  CreateProPlanDto,
  ProPlanDto,
  UpdateCoinPackDto,
  UpdateProPlanDto,
} from './dto/catalog.dto';

// Outer columns are spelled out: in a single-table select Drizzle leaves them unqualified,
// and a bare "id" inside the subquery would bind to the inner table.
const packPurchases = sql<number>`(select count(*)::int from ${payments}
  where ${payments.productType} = 'coin_pack' and ${payments.productId} = "coin_packs"."id")`;
const planActiveSubscriptions = sql<number>`(select count(*)::int from ${subscriptions}
  where ${subscriptions.planId} = "pro_plans"."id" and ${subscriptions.status} = 'active'
    and ${subscriptions.expiresAt} > now())`;

/** Coin packs and Pro plans. Nothing is deleted — set `active: false` to take a product off sale. */
@Injectable()
export class CatalogService {
  constructor(
    @Inject(DB) private readonly db: Database,
    private readonly audit: AuditService,
  ) {}

  listPacks(): Promise<CoinPackDto[]> {
    return this.db
      .select({ ...getTableColumns(coinPacks), purchases: packPurchases })
      .from(coinPacks)
      .orderBy(asc(coinPacks.sortOrder), asc(coinPacks.id));
  }

  async createPack(actor: AdminPrincipal, dto: CreateCoinPackDto): Promise<CoinPackDto> {
    await this.db.transaction(async (tx) => {
      const [created] = await tx.insert(coinPacks).values(dto).onConflictDoNothing().returning({ id: coinPacks.id });
      if (!created) throw conflict(`Coin pack "${dto.id}" already exists`);
      await this.audit.record(actor, { action: 'coin_pack.create', targetType: 'coin_pack', targetId: dto.id, metadata: { ...dto } }, tx);
    });
    return this.getPack(dto.id);
  }

  async updatePack(actor: AdminPrincipal, id: string, dto: UpdateCoinPackDto): Promise<CoinPackDto> {
    await this.db.transaction(async (tx) => {
      const [updated] = await tx.update(coinPacks).set(dto).where(eq(coinPacks.id, id)).returning({ id: coinPacks.id });
      if (!updated) throw notFound('Coin pack');
      await this.audit.record(actor, { action: 'coin_pack.update', targetType: 'coin_pack', targetId: id, metadata: { ...dto } }, tx);
    });
    return this.getPack(id);
  }

  listPlans(): Promise<ProPlanDto[]> {
    return this.db
      .select({ ...getTableColumns(proPlans), activeSubscriptions: planActiveSubscriptions })
      .from(proPlans)
      .orderBy(asc(proPlans.sortOrder), asc(proPlans.id));
  }

  async createPlan(actor: AdminPrincipal, dto: CreateProPlanDto): Promise<ProPlanDto> {
    await this.db.transaction(async (tx) => {
      const [created] = await tx.insert(proPlans).values(dto).onConflictDoNothing().returning({ id: proPlans.id });
      if (!created) throw conflict(`Pro plan "${dto.id}" already exists`);
      await this.audit.record(actor, { action: 'pro_plan.create', targetType: 'pro_plan', targetId: dto.id, metadata: { ...dto } }, tx);
    });
    return this.getPlan(dto.id);
  }

  async updatePlan(actor: AdminPrincipal, id: string, dto: UpdateProPlanDto): Promise<ProPlanDto> {
    await this.db.transaction(async (tx) => {
      const [updated] = await tx.update(proPlans).set(dto).where(eq(proPlans.id, id)).returning({ id: proPlans.id });
      if (!updated) throw notFound('Pro plan');
      await this.audit.record(actor, { action: 'pro_plan.update', targetType: 'pro_plan', targetId: id, metadata: { ...dto } }, tx);
    });
    return this.getPlan(id);
  }

  private async getPack(id: string): Promise<CoinPackDto> {
    const [pack] = await this.db
      .select({ ...getTableColumns(coinPacks), purchases: packPurchases })
      .from(coinPacks)
      .where(eq(coinPacks.id, id));
    if (!pack) throw notFound('Coin pack');
    return pack;
  }

  private async getPlan(id: string): Promise<ProPlanDto> {
    const [plan] = await this.db
      .select({ ...getTableColumns(proPlans), activeSubscriptions: planActiveSubscriptions })
      .from(proPlans)
      .where(eq(proPlans.id, id));
    if (!plan) throw notFound('Pro plan');
    return plan;
  }
}
