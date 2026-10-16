import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../../common/decorators/public.decorator';
import {
  CitiesQueryDto,
  CountryDto,
  NearestLocationDto,
  NearestQueryDto,
  StatesQueryDto,
} from './dto/locations.dto';
import { LocationsService } from './locations.service';

@ApiTags('Meta')
@Controller('meta/locations')
export class LocationsController {
  constructor(private readonly locations: LocationsService) {}

  @Public()
  @Get('countries')
  @ApiOperation({ summary: 'Countries we support' })
  @ApiOkResponse({ type: CountryDto, isArray: true })
  countries() {
    return this.locations.countries();
  }

  @Public()
  @Get('states')
  @ApiOperation({ summary: 'State names of one country' })
  @ApiOkResponse({ type: String, isArray: true })
  states(@Query() query: StatesQueryDto) {
    return this.locations.states(query.country);
  }

  @Public()
  @Get('cities')
  @ApiOperation({ summary: 'City names of one state' })
  @ApiOkResponse({ type: String, isArray: true })
  cities(@Query() query: CitiesQueryDto) {
    return this.locations.cities(query.country, query.state);
  }

  @Public()
  @Get('nearest')
  @ApiOperation({ summary: 'Closest city to a point, 404 LOCATION_NOT_SUPPORTED if none within 150 km' })
  @ApiOkResponse({ type: NearestLocationDto })
  nearest(@Query() query: NearestQueryDto) {
    return this.locations.nearest(query.lat, query.lng);
  }
}