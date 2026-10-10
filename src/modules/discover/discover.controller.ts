import { Controller, Get, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { CurrentUser } from '../../common/decorators/current-user.decorator';
import type { AuthUser } from '../../common/types/auth-user';
import { PersonDto } from '../people/dto/person.dto';
import { DiscoverService } from './discover.service';
import { DiscoverQueryDto, PeoplePageDto } from './dto/discover.dto';

@ApiTags('Discover')
@ApiBearerAuth()
@Controller('discover')
export class DiscoverController {
  constructor(private readonly discover: DiscoverService) {}

  @Get()
  @ApiOperation({
    summary: 'Home feed of people',
    description: 'Height, city and bio-length filters need Pro (403 PRO_REQUIRED).',
  })
  feed(@CurrentUser() user: AuthUser, @Query() query: DiscoverQueryDto): Promise<PeoplePageDto> {
    return this.discover.feed(user.id, query);
  }

  @Get('spotlight')
  @ApiOperation({ summary: "Today's spotlight profile (null when nobody is discoverable)" })
  @ApiOkResponse({ type: PersonDto })
  spotlight(@CurrentUser() user: AuthUser): Promise<PersonDto | null> {
    return this.discover.spotlight(user.id);
  }
}
