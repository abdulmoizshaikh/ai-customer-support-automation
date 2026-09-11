import "dotenv/config";

interface EnvConfig {
  databaseUrl: string;
  port: number;
  jwt: {
    accessSecret: string;
    refreshSecret: string;
    accessTtl: string;
    refreshTtl: string;
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
  databaseUrl: required("DATABASE_URL"),
  port: Number(process.env.PORT ?? 3000),
  jwt: {
    accessSecret: required("JWT_ACCESS_SECRET"),
    refreshSecret: required("JWT_REFRESH_SECRET"),
    accessTtl: process.env.JWT_ACCESS_TTL ?? "15m",
    refreshTtl: process.env.JWT_REFRESH_TTL ?? "7d",
  },
};

export const envConfig: Readonly<EnvConfig> = env;

export function isProduction(): boolean {
  return process.env.NODE_ENV === "production";
}