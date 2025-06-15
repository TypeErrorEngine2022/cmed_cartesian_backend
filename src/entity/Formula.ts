import {
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  Column,
  Index,
  BeforeInsert,
  BeforeUpdate,
} from "typeorm";
import { Attribute } from "./Attribute";
import cnchar from "cnchar";
import trad from "cnchar-trad";
cnchar.use(trad);

@Entity()
@Index(["name"], { unique: true })
export class Formula {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;

  @Column({ type: "text", nullable: true })
  annotation: string;

  @OneToMany(() => Attribute, (attr) => attr.formula)
  attributes: Attribute[];

  @Column()
  spell: string;

  @BeforeInsert()
  @BeforeUpdate()
  calculateSpell() {
    try {
      this.spell = this.name.spell() as string;
    } catch (e) {
      console.error(`Failed to calculate spell for "${this.name}":`, e);
      this.spell = "";
    }
  }
}
