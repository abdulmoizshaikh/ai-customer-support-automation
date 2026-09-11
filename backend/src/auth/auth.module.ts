import { Global, Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtModule } from '@nestjs/jwt';
import { ThrottlerGuard } from '@nestjs/throttler';
import { envConfig } from '../common/config.js';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard.js';
import { RolesGuard } from '../common/guards/roles.guard.js';
import { AuthController } from './auth.controller.js';
import { AuthService } from './auth.service.js';

@Global()
@Module({
  imports: [
    JwtModule.register({
      global: true,
      secret: envConfig.jwt.accessSecret,
      signOptions: { expiresIn: envConfig.jwt.accessTtl },
    }),
  ],
  controllers: [AuthController],
  providers: [
    // Order matters: JwtAuthGuard runs first and populates request.user from
    // the JWT; RolesGuard then reads request.user.role; ThrottlerGuard applies
    // rate limits after auth so authenticated low-volume routes are not
    // double-counted against public abuse.
    { provide: APP_GUARD, useClass: JwtAuthGuard },
    { provide: APP_GUARD, useClass: RolesGuard },
    { provide: APP_GUARD, useClass: ThrottlerGuard },

    AuthService,
  ],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}
