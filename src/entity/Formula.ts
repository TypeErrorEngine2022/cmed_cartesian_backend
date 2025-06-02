import { Entity, PrimaryGeneratedColumn, OneToMany, Column } from "typeorm";
import { Attribute } from "./Attribute";

@Entity()
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