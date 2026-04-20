import { DataSource } from 'typeorm';
import { SnakeNamingStrategy } from 'typeorm-naming-strategies';
import { config as loadEnv } from 'dotenv';
import * as path from 'path';

loadEnv({ path: path.resolve(process.cwd(), '.env') });

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: process.env.DATABASE_HOST ?? 'bp-postgres',
  port: Number(process.env.DATABASE_PORT) || 5432,
  username: process.env.DATABASE_USER ?? 'bp',
  password: process.env.DATABASE_PASSWORD ?? 'bp',
  database: process.env.DATABASE_NAME ?? 'bp',
  ssl:
    process.env.DATABASE_SSL === 'true'
      ? { rejectUnauthorized: true }
      : false,
  // Миграции используют snake_case — SnakeNamingStrategy приводит camelCase
  // колонки entity к password_hash / full_name / refresh_token_hash и т.п.
  namingStrategy: new SnakeNamingStrategy(),
  entities: [path.join(__dirname, '..', '**', '*.entity.{ts,js}')],
  migrations: [path.join(__dirname, '..', '..', 'migrations', '*.{ts,js}')],
  synchronize: false,
  logging: process.env.NODE_ENV === 'development' ? ['warn', 'error'] : ['error'],
});
