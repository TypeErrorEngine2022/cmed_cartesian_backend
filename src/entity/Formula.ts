import {
  Entity,
  PrimaryGeneratedColumn,
  OneToMany,
  Column,
  Index,
} from "typeorm";
import { Attribute } from "./Attribute";

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
}
