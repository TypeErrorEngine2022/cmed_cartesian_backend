import { MigrationInterface, QueryRunner } from "typeorm";
import cnchar from "cnchar";
import trad from "cnchar-trad";
cnchar.use(trad);

export class AddSpell1749717951839 implements MigrationInterface {
    public async up(queryRunner: QueryRunner): Promise<void> {
        // Add column with empty string default
        await queryRunner.query(`ALTER TABLE "formula" ADD "spell" character varying NOT NULL DEFAULT ''`);
        
        // Update existing records with proper spell values
        const formulas = await queryRunner.query("SELECT id, name FROM formula");
        for (const formula of formulas) {
            try {
                const spell = formula.name.spell();
                await queryRunner.query(
                    `UPDATE formula SET spell = $1 WHERE id = $2`,
                    [spell, formula.id]
                );
            } catch (e) {
                console.error(`Failed to calculate spell for "${formula.name}"`, e);
                // No need to update as default is already empty string
            }
        }
        
        // Remove the default constraint (optional)
        await queryRunner.query(`ALTER TABLE "formula" ALTER COLUMN "spell" DROP DEFAULT`);
    }

    public async down(queryRunner: QueryRunner): Promise<void> {
        await queryRunner.query(`ALTER TABLE "formula" DROP COLUMN "spell"`);
    }
}