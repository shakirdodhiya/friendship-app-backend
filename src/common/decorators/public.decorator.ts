import { Reflector } from '@nestjs/core';

/** Opts a route out of the global JWT guard. */
export const Public = Reflector.createDecorator<true>({ transform: () => true });
