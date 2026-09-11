import { Global, Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { envConfig } from '../common/config.js';
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
  providers: [AuthService],
  exports: [AuthService, JwtModule],
})
export class AuthModule {}