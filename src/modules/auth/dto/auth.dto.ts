import { MeDto } from '../../users/dto/me.dto';

export class SessionDto {
  /** True the first time this Firebase account signs in — send the user through onboarding. */
  isNewUser: boolean;
  user: MeDto;
}
