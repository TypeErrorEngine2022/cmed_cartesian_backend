import { DataSource } from "typeorm";
import { Formula } from "./entity/Formula";
import { Criteria } from "./entity/Criteria";
import { Attribute } from "./entity/Attribute";
import dotenv from "dotenv";
import { AxisSetting } from "./entity/AxisSetting";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.ENV_DATABASE_URL,
  synchronize: process.env.NODE_ENV !== "production", // Only synchronize in development
  logging: process.env.NODE_ENV !== "production",
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  entities: [Formula, Criteria, Attribute, AxisSetting],
  subscribers: [],
  migrations: ["src/migration/**/*.ts"],
  poolSize: 10,
  connectTimeoutMS: 5000,
  maxQueryExecutionTime: 1500,
  extra: {
    // PG specific options
    max: 10, // Max connections (same as poolSize, but specifically for pg)
    idleTimeoutMillis: 30000, // How long a connection can be idle before being released
  },
});
