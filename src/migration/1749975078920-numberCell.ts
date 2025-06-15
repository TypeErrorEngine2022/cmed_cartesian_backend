import { MigrationInterface, QueryRunner } from "typeorm";

export class NumberCell1749975078920 implements MigrationInterface {
    name = 'NumberCell1749975078920'

    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add a temporary column to store the converted values
        await queryRunner.query(`ALTER TABLE "attribute" ADD COLUMN "value_numeric" integer`);
        
        // Convert existing values to integer
        await queryRunner.query(`UPDATE "attribute" SET "value_numeric" = CAST("value" AS integer) WHERE "value" ~ '^[0-9]+$'`);
        
        // Drop the original value column
        await queryRunner.query(`ALTER TABLE "attribute" DROP COLUMN "value"`);
        
        // Create the new integer column and set default
        await queryRunner.query(`ALTER TABLE "attribute" ADD COLUMN "value" integer NOT NULL DEFAULT '0'`);
        
        // Copy the converted values to the new column
        await queryRunner.query(`UPDATE "attribute" SET "value" = COALESCE("value_numeric", 0)`);
        
        // Drop the temporary column
        await queryRunner.query(`ALTER TABLE "attribute" DROP COLUMN "value_numeric"`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        // Add a temporary column to store the string values
        await queryRunner.query(`ALTER TABLE "attribute" ADD COLUMN "value_text" character varying`);
        
        // Convert integer values to strings
        await queryRunner.query(`UPDATE "attribute" SET "value_text" = "value"::text`);
        
        // Drop the integer column
        await queryRunner.query(`ALTER TABLE "attribute" DROP COLUMN "value"`);
        
        // Create the original string column
        await queryRunner.query(`ALTER TABLE "attribute" ADD COLUMN "value" character varying NOT NULL DEFAULT 'NA'`);
        
        // Copy the converted values back
        await queryRunner.query(`UPDATE "attribute" SET "value" = COALESCE("value_text", 'NA')`);
        
        // Drop the temporary column
        await queryRunner.query(`ALTER TABLE "attribute" DROP COLUMN "value_text"`);
    }
}