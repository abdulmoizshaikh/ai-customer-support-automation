import type { Request } from 'express';
import { AuthUser } from '../decorators/current-user.decorator.js';

export type RequestWithUser = Request & { user: AuthUser };
