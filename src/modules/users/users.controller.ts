import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { PersonDto } from '../people/dto/person.dto';
import { PeopleService } from '../people/people.service';
import { MeDto, PhotoDto } from './dto/me.dto';
import {
  AvatarUpdateResultDto,
  OwnedAvatarItemDto,
  UpdateAvatarDto,
  UpdateProfileDto,
  UploadPhotoDto,
  VerificationStatusDto,
} from './dto/update-profile.dto';
import { UsersService } from './users.service';

const imageUploadBody = (extra: Record<string, object> = {}) =>
  ApiBody({
    schema: {
      type: 'object',
      required: ['file', ...Object.keys(extra)],
      properties: { file: { type: 'string', format: 'binary', description: 'JPEG, PNG or WebP' }, ...extra },
    },
  });

@ApiTags('Users')
@ApiBearerAuth()
@Controller('users')
export class UsersController {
  constructor(
    private readonly users: UsersService,
    private readonly people: PeopleService,
  ) {}

  @Get('me')
  @ApiOperation({ summary: 'Get my full profile, coin balance and Pro status' })
  getMe(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.users.getMe(user.id);
  }

  @Patch('me')
  @ApiOperation({
    summary: 'Update my profile',
    description: 'Used by every onboarding step and every editable row on the profile tab. Send only changed fields.',
  })
  update(@CurrentUser() user: AuthUser, @Body() dto: UpdateProfileDto): Promise<MeDto> {
    return this.users.updateProfile(user.id, dto);
  }

  @Post('me/onboarding/complete')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: 'Finish onboarding',
    description: 'Requires name, birthday, gender, at least 5 interests and a short bio. Makes the profile discoverable.',
  })
  completeOnboarding(@CurrentUser() user: AuthUser): Promise<MeDto> {
    return this.users.completeOnboarding(user.id);
  }

  @Put('me/avatar')
  @ApiOperation({
    summary: 'Save my avatar',
    description: 'Premium options not owned yet are bought with coins in the same call (402 INSUFFICIENT_COINS otherwise).',
  })
  updateAvatar(@CurrentUser() user: AuthUser, @Body() dto: UpdateAvatarDto): Promise<AvatarUpdateResultDto> {
    return this.users.updateAvatar(user.id, dto);
  }

  @Get('me/avatar/items')
  @ApiOperation({ summary: 'List premium avatar options I own' })
  avatarItems(@CurrentUser() user: AuthUser): Promise<OwnedAvatarItemDto[]> {
    return this.users.listAvatarItems(user.id);
  }

  @Post('me/photos')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @imageUploadBody({ position: { type: 'integer', minimum: 0, maximum: 5 } })
  @ApiOperation({ summary: 'Upload a photo into a grid slot (replaces the slot)' })
  uploadPhoto(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
    @Body() dto: UploadPhotoDto,
  ): Promise<PhotoDto> {
    return this.users.uploadPhoto(user.id, file, dto.position);
  }

  @Delete('me/photos/:photoId')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete one of my photos' })
  deletePhoto(@CurrentUser() user: AuthUser, @Param('photoId', ParseUUIDPipe) photoId: string): Promise<void> {
    return this.users.deletePhoto(user.id, photoId);
  }

  @Post('me/verification')
  @UseInterceptors(FileInterceptor('file'))
  @ApiConsumes('multipart/form-data')
  @imageUploadBody()
  @ApiOperation({ summary: 'Submit a selfie to get the verified badge' })
  verify(
    @CurrentUser() user: AuthUser,
    @UploadedFile() file: Express.Multer.File | undefined,
  ): Promise<VerificationStatusDto> {
    return this.users.submitVerification(user.id, file);
  }

  @Delete('me')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Delete my account', description: 'Wipes personal data and signs out every device.' })
  deleteAccount(@CurrentUser() user: AuthUser): Promise<void> {
    return this.users.deleteAccount(user.id);
  }

  @Get(':id')
  @ApiOperation({ summary: "Get someone's public profile" })
  async getPerson(@CurrentUser() user: AuthUser, @Param('id', ParseUUIDPipe) id: string): Promise<PersonDto> {
    const viewer = await this.users.findActive(user.id);
    return this.people.getById(viewer, id);
  }
}
