import {
  Entity,
  Column,
  PrimaryGeneratedColumn,
  ManyToOne,
  JoinColumn
} from "typeorm";
import { Formula } from "./Formula";

@Entity()
export class Attribute {
  @PrimaryGeneratedColumn()
  id: number;

  @Column()
  formula_id: number;

  @ManyToOne(() => Formula, (formula) => formula.attributes)
  @JoinColumn({ name: "formula_id" })
  formula: Formula;

  @Column()
  criteria_id: number;

  @Column({ default: "NA" })
  value: string;
}