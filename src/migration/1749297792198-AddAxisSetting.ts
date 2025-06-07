import { MigrationInterface, QueryRunner } from "typeorm";

export class AddAxisSetting1749297792198 implements MigrationInterface {
    name = 'AddAxisSetting1749297792198'

    public async up(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`CREATE TABLE "axis_setting" ("id" SERIAL NOT NULL, "name" character varying NOT NULL, "xNegative_criteria_id" integer NOT NULL, "xPositive_criteria_id" integer NOT NULL, "yNegative_criteria_id" integer NOT NULL, "yPositive_criteria_id" integer NOT NULL, CONSTRAINT "UQ_2a2fa18e029a67a47a309bf79bc" UNIQUE ("name"), CONSTRAINT "PK_30c691c4357f6ce6810d57d5260" PRIMARY KEY ("id"))`);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_2a2fa18e029a67a47a309bf79b" ON "axis_setting" ("name") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_813025cf3a938cdf78257b9814" ON "attribute" ("formula_id", "criteria_id") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_d06f849472ad471206bfe1327e" ON "formula" ("name") `);
        await queryRunner.query(`CREATE UNIQUE INDEX "IDX_51e891968b4420f3bb869e9119" ON "criteria" ("name") `);
        await queryRunner.query(`ALTER TABLE "axis_setting" ADD CONSTRAINT "FK_080d81beb36694604742623a65c" FOREIGN KEY ("xNegative_criteria_id") REFERENCES "criteria"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "axis_setting" ADD CONSTRAINT "FK_c1edc7b263e51e3b1b9692f233c" FOREIGN KEY ("xPositive_criteria_id") REFERENCES "criteria"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "axis_setting" ADD CONSTRAINT "FK_cf16911218ba7b0ff21b640d555" FOREIGN KEY ("yNegative_criteria_id") REFERENCES "criteria"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
        await queryRunner.query(`ALTER TABLE "axis_setting" ADD CONSTRAINT "FK_c339c68523262fadddfb85b7543" FOREIGN KEY ("yPositive_criteria_id") REFERENCES "criteria"("id") ON DELETE NO ACTION ON UPDATE NO ACTION`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "axis_setting" DROP CONSTRAINT "FK_c339c68523262fadddfb85b7543"`);
        await queryRunner.query(`ALTER TABLE "axis_setting" DROP CONSTRAINT "FK_cf16911218ba7b0ff21b640d555"`);
        await queryRunner.query(`ALTER TABLE "axis_setting" DROP CONSTRAINT "FK_c1edc7b263e51e3b1b9692f233c"`);
        await queryRunner.query(`ALTER TABLE "axis_setting" DROP CONSTRAINT "FK_080d81beb36694604742623a65c"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_51e891968b4420f3bb869e9119"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_d06f849472ad471206bfe1327e"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_813025cf3a938cdf78257b9814"`);
        await queryRunner.query(`DROP INDEX "public"."IDX_2a2fa18e029a67a47a309bf79b"`);
        await queryRunner.query(`DROP TABLE "axis_setting"`);
    }

}
