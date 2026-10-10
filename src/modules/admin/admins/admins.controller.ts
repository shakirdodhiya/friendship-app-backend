import { Body, Delete, Get, HttpCode, HttpStatus, Param, ParseUUIDPipe, Patch, Post } from '@nestjs/common';
import { ApiOperation } from '@nestjs/swagger';

import { AdminController, CurrentAdmin, MinRole } from '../common/admin.decorators';
import type { AdminPrincipal } from '../common/types';
import { AdminsService } from './admins.service';
import { AdminDto, CreateAdminDto, UpdateAdminDto } from './dto/admins.dto';

@AdminController('admins', 'Admin accounts')
@MinRole('super_admin')
export class AdminsController {
  constructor(private readonly admins: AdminsService) {}

  @Get()
  @ApiOperation({ summary: 'All admin accounts' })
  list(): Promise<AdminDto[]> {
    return this.admins.list();
  }

  @Post()
  @ApiOperation({ summary: 'Create an admin account' })
  create(@CurrentAdmin() actor: AdminPrincipal, @Body() dto: CreateAdminDto): Promise<AdminDto> {
    return this.admins.create(actor, dto);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Rename, change role, deactivate or reset the password of an admin' })
  update(
    @CurrentAdmin() actor: AdminPrincipal,
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateAdminDto,
  ): Promise<AdminDto> {
    return this.admins.update(actor, id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete an admin account' })
  remove(@CurrentAdmin() actor: AdminPrincipal, @Param('id', ParseUUIDPipe) id: string): Promise<void> {
    return this.admins.remove(actor, id);
  }
}
