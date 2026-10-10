import { Module } from '@nestjs/common';

import { UsersModule } from '../users/users.module';
import { WalletModule } from '../wallet/wallet.module';
import { AdminsController } from './admins/admins.controller';
import { AdminsService } from './admins/admins.service';
import { AuditController } from './audit/audit.controller';
import { AdminAuthController } from './auth/admin-auth.controller';
import { AdminAuthService } from './auth/admin-auth.service';
import { BillingController } from './billing/billing.controller';
import { BillingService } from './billing/billing.service';
import { CatalogController } from './catalog/catalog.controller';
import { CatalogService } from './catalog/catalog.service';
import { AdminAuthGuard } from './common/admin-auth.guard';
import { AdminTokenService } from './common/admin-token.service';
import { AuditService } from './common/audit.service';
import { AdminCommunityController } from './community/admin-community.controller';
import { AdminCommunityService } from './community/admin-community.service';
import { DashboardController } from './dashboard/dashboard.controller';
import { DashboardService } from './dashboard/dashboard.service';
import { ReportsController } from './reports/reports.controller';
import { ReportsService } from './reports/reports.service';
import { AdminUsersController } from './users/admin-users.controller';
import { AdminUsersService } from './users/admin-users.service';
import { VerificationsController } from './verifications/verifications.controller';
import { VerificationsService } from './verifications/verifications.service';

/**
 * Back office for the admin portal (`../friendship-app-admin`). Every route lives under `/api/v1/admin`
 * and takes an admin token from `POST /admin/auth/login` instead of a Firebase ID token.
 */
@Module({
  imports: [UsersModule, WalletModule],
  controllers: [
    AdminAuthController,
    AdminsController,
    DashboardController,
    AdminUsersController,
    VerificationsController,
    ReportsController,
    AdminCommunityController,
    CatalogController,
    BillingController,
    AuditController,
  ],
  providers: [
    AdminTokenService,
    AdminAuthGuard,
    AuditService,
    AdminAuthService,
    AdminsService,
    DashboardService,
    AdminUsersService,
    VerificationsService,
    ReportsService,
    AdminCommunityService,
    CatalogService,
    BillingService,
  ],
})
export class AdminModule {}
