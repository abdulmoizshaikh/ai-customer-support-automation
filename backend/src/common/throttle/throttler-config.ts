import { ThrottlerModuleOptions } from '@nestjs/throttler';

export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    { name: 'default', ttl: 60_000, limit: 60 }, // 60 req/min per IP
  ],
};
