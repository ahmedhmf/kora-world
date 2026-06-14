import { DataSource } from 'typeorm';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '../.env') });
dotenv.config();

const dbHost = process.env.DATABASE_HOST || 'localhost';
const dbPort = parseInt(process.env.DATABASE_PORT || '5432');
const dbUser = process.env.DATABASE_USER || process.env.DB_USER;
const dbPassword = process.env.DATABASE_PASSWORD || process.env.DB_PASSWORD;
const dbName = process.env.DATABASE_NAME || process.env.DB_NAME;

export const AppDataSource = new DataSource({
  type: 'postgres',
  host: dbHost,
  port: dbPort,
  username: dbUser,
  password: dbPassword,
  database: dbName,
  entities: [],
  migrations: ['src/migrations/*{.ts,.js}'],
  synchronize: false,
});
