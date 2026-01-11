import { Field, Int, ObjectType } from '@nestjs/graphql';
import { User } from '../users/user.entity';

@ObjectType()
export class Job {
  @Field(() => Int)
  id!: number;

  @Field()
  title!: string;

  @Field(() => String, { nullable: true })
  description?: string | null;

  @Field(() => Int)
  budget!: number;

  @Field()
  status!: string;

  @Field(() => [String])
  skills!: string[];

  @Field()
  isActive!: boolean;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => Date, { nullable: true })
  deletedAt?: Date | null;

  @Field()
  posterId!: string; // BigInt as string for GraphQL

  @Field(() => User)
  poster!: User;
}
