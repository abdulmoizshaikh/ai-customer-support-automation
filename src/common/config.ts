import 'dotenv/config';

type DurationUnit = 'ms' | 's' | 'm' | 'h' | 'd' | 'w' | 'y';
export type JwtDuration =
  `${number}` | `${number}${DurationUnit}` | `${number} ${DurationUnit}`;

interface EnvConfig {
  databaseUrl: string;
  port: number;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: JwtDuration;
    refreshTtl: JwtDuration;
  };
}

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

const env: EnvConfig = {
  databaseUrl: required('DATABASE_URL'),
  port: Number(process.env.PORT ?? 3000),
  jwt: {
    accessSecret: required('JWT_ACCESS_SECRET'),
    refreshSecret: required('JWT_REFRESH_SECRET'),
    accessTtl: (process.env.JWT_ACCESS_TTL ?? '15m') as JwtDuration,
    refreshTtl: (process.env.JWT_REFRESH_TTL ?? '7d') as JwtDuration,
  },
};

export const envConfig: Readonly<EnvConfig> = env;

export function isProduction(): boolean {
  return process.env.NODE_ENV === 'production';
}
