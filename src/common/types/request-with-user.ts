import type { Request } from 'express';
import { AuthUser } from './current-user.decorator.js';

export type RequestWithUser = Request & { user: AuthUser };