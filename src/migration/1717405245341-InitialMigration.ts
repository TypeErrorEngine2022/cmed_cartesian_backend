import { MigrationInterface, QueryRunner } from "typeorm";

export class InitialMigration1717405245341 implements MigrationInterface {
  name = "InitialMigration1717405245341";

  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "attribute" (
                "id" SERIAL PRIMARY KEY,
                "name" character varying NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "criteria" (
                "id" SERIAL PRIMARY KEY,
                "name" character varying NOT NULL,
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now()
            )
        `);

    await queryRunner.query(`
            CREATE TABLE IF NOT EXISTS "formula" (
                "id" SERIAL PRIMARY KEY,
                "attribute_id" integer NOT NULL,
                "criteria_id" integer NOT NULL,
                "value" double precision NOT NULL DEFAULT '0',
                "created_at" TIMESTAMP NOT NULL DEFAULT now(),
                "updated_at" TIMESTAMP NOT NULL DEFAULT now(),
                CONSTRAINT "PK_formula_attribute_criteria" UNIQUE ("attribute_id", "criteria_id"),
                CONSTRAINT "FK_formula_attribute" FOREIGN KEY ("attribute_id") REFERENCES "attribute"("id") ON DELETE CASCADE,
                CONSTRAINT "FK_formula_criteria" FOREIGN KEY ("criteria_id") REFERENCES "criteria"("id") ON DELETE CASCADE
            )
        `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`DROP TABLE "formula"`);
    await queryRunner.query(`DROP TABLE "criteria"`);
    await queryRunner.query(`DROP TABLE "attribute"`);
  }
}
