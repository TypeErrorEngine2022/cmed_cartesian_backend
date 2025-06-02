import { Entity, Column, PrimaryGeneratedColumn } from "typeorm";

@Entity()
export class Criteria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;
}
