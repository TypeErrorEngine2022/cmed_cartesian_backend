import { DataSource } from "typeorm";
import { Formula } from "./entity/Formula";
import { Criteria } from "./entity/Criteria";
import { Attribute } from "./entity/Attribute";
import dotenv from "dotenv";

dotenv.config();

export const AppDataSource = new DataSource({
  type: "postgres",
  url: process.env.DATABASE_URL,
  synchronize: process.env.NODE_ENV !== "production", // Only synchronize in development
  logging: process.env.NODE_ENV !== "production",
  ssl:
    process.env.NODE_ENV === "production"
      ? { rejectUnauthorized: false }
      : false,
  entities: [Formula, Criteria, Attribute],
  subscribers: [],
  migrations: ["src/migration/**/*.ts"],
});
