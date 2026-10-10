import { Body, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Post, Query } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { AdminController, CurrentAdmin } from '../common/admin.decorators';
import type { AdminPrincipal } from '../common/types';
import {
  ReviewVerificationDto,
  VerificationPageDto,
  VerificationRequestDto,
  VerificationsQueryDto,
} from './dto/verifications.dto';
import { VerificationsService } from './verifications.service';

@AdminController('verifications', 'Verifications')
export class VerificationsController {
  constructor(private readonly verifications: VerificationsService) {}

  @Get()
  @ApiOperation({ summary: 'Selfie verification requests', description: 'Pending requests come oldest first.' })
  list(@Query() query: VerificationsQueryDto): Promise<VerificationPageDto> {
    return this.verifications.list(query);
  }

  @Post(':id/review')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Approve or reject a pending request', description: "Also updates the user's verified badge." })
  review(
    @CurrentAdmin() admin: AdminPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: ReviewVerificationDto,
  ): Promise<VerificationRequestDto> {
    return this.verifications.review(admin, id, dto);
  }
}
