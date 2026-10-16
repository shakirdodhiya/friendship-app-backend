import { Type } from 'class-transformer';
import { IsNotEmpty, IsNumber, IsString, Max, MaxLength, Min } from 'class-validator';

export class CountryDto {
  /** ISO code, e.g. `IN` */
  code: string;
  name: string;
}

export class NearestLocationDto {
  country: string;
  countryCode: string;
  state: string;
  city: string;
  /** How far the city is from the given point */
  distanceKm: number;
}

// the bottom decorator's message is the one the client sees, so the "required" check goes last
export class StatesQueryDto {
  /** Country code or name, e.g. `IN` or `India` */
  @MaxLength(80)
  @IsString()
  @IsNotEmpty({ message: 'country is required' })
  country: string;
}

export class CitiesQueryDto extends StatesQueryDto {
  @MaxLength(80)
  @IsString()
  @IsNotEmpty({ message: 'state is required' })
  state: string;
}

export class NearestQueryDto {
  @Type(() => Number)
  @Max(90)
  @Min(-90)
  @IsNumber({}, { message: 'lat is required, a number between -90 and 90' })
  lat: number;

  @Type(() => Number)
  @Max(180)
  @Min(-180)
  @IsNumber({}, { message: 'lng is required, a number between -180 and 180' })
  lng: number;
}