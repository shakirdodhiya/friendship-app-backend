import { Body, Get, Param, Patch, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { AdminController, CurrentAdmin, MinRole } from '../common/admin.decorators';
import type { AdminPrincipal } from '../common/types';
import { CatalogService } from './catalog.service';
import {
  CoinPackDto,
  CreateCoinPackDto,
  CreateProPlanDto,
  ProPlanDto,
  UpdateCoinPackDto,
  UpdateProPlanDto,
} from './dto/catalog.dto';

@AdminController('catalog', 'Catalog')
@MinRole('admin')
export class CatalogController {
  constructor(private readonly catalog: CatalogService) {}

  @Get('coin-packs')
  @ApiOperation({ summary: 'Coin packs, including inactive ones' })
  listPacks(): Promise<CoinPackDto[]> {
    return this.catalog.listPacks();
  }

  @Post('coin-packs')
  @ApiOperation({ summary: 'Add a coin pack' })
  createPack(@CurrentAdmin() admin: AdminPrincipal, @Body() dto: CreateCoinPackDto): Promise<CoinPackDto> {
    return this.catalog.createPack(admin, dto);
  }

  @Patch('coin-packs/:id')
  @ApiOperation({ summary: 'Edit a coin pack, or take it off sale with `active: false`' })
  updatePack(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateCoinPackDto,
  ): Promise<CoinPackDto> {
    return this.catalog.updatePack(admin, id, dto);
  }

  @Get('pro-plans')
  @ApiOperation({ summary: 'Pro plans, including inactive ones' })
  listPlans(): Promise<ProPlanDto[]> {
    return this.catalog.listPlans();
  }

  @Post('pro-plans')
  @ApiOperation({ summary: 'Add a Pro plan' })
  createPlan(@CurrentAdmin() admin: AdminPrincipal, @Body() dto: CreateProPlanDto): Promise<ProPlanDto> {
    return this.catalog.createPlan(admin, dto);
  }

  @Patch('pro-plans/:id')
  @ApiOperation({ summary: 'Edit a Pro plan, or take it off sale with `active: false`' })
  updatePlan(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id') id: string,
    @Body() dto: UpdateProPlanDto,
  ): Promise<ProPlanDto> {
    return this.catalog.updatePlan(admin, id, dto);
  }
}
