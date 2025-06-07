import { Entity, Column, PrimaryGeneratedColumn, Index } from "typeorm";

@Entity()
@Index(["name"], { unique: true })
export class Criteria {
  @PrimaryGeneratedColumn()
  id: number;

  @Column({ unique: true })
  name: string;
}
