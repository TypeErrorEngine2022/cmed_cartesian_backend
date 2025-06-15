import { Column, Entity, Index, PrimaryGeneratedColumn, ManyToOne, JoinColumn } from "typeorm";
import { Criteria } from "./Criteria";

@Entity()
@Index(["name"], { unique: true })
export class AxisSetting {
    @PrimaryGeneratedColumn()
    id: number;
    
    @Column({ unique: true })
    name: string;
    
    @Column()
    xNegative_criteria_id: number;

    @ManyToOne(() => Criteria)
    @JoinColumn({ name: "xNegative_criteria_id" })
    xNegativeCriteria: Criteria;

    @Column()
    xPositive_criteria_id: number;

    @ManyToOne(() => Criteria)
    @JoinColumn({ name: "xPositive_criteria_id" })
    xPositiveCriteria: Criteria;

    @Column()
    yNegative_criteria_id: number;

    @ManyToOne(() => Criteria)
    @JoinColumn({ name: "yNegative_criteria_id" })
    yNegativeCriteria: Criteria;

    @Column()
    yPositive_criteria_id: number;

    @ManyToOne(() => Criteria)
    @JoinColumn({ name: "yPositive_criteria_id" })
    yPositiveCriteria: Criteria;
}