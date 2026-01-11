import { Field, ObjectType, registerEnumType } from '@nestjs/graphql';
import { Gender, UserRole } from '@prisma/client';
import { Exclude } from 'class-transformer';
import { Job } from '../job/job.entity';

// Re-export enums for use in other files
export { Gender, UserRole };

registerEnumType(UserRole, {
  name: 'UserRole',
});

registerEnumType(Gender, {
  name: 'Gender',
});

@ObjectType()
export class User {
  @Field()
  id!: string; // BigInt as string for GraphQL

  // Credentials
  @Field()
  email!: string;

  @Field(() => String, { nullable: true })
  phone?: string | null;

  @Exclude()
  password?: string;

  // Personal details
  @Field(() => String, { nullable: true })
  firstName?: string | null;

  @Field(() => String, { nullable: true })
  lastName?: string | null;

  @Field(() => Date, { nullable: true })
  dob?: Date | null;

  @Field(() => Gender, { nullable: true })
  gender?: Gender | null;

  @Field(() => String, { nullable: true })
  photoUrl?: string | null;

  // Identity Verification (KYC)
  @Field(() => String, { nullable: true })
  identityNumber?: string | null;

  @Field()
  identityStatus!: boolean;

  @Field(() => String, { nullable: true })
  identityUrl?: string | null;

  // System / Account
  @Field(() => String, { nullable: true })
  username?: string | null;

  @Field(() => UserRole)
  role!: UserRole;

  @Field(() => String, { nullable: true })
  countryCode?: string | null;

  @Field()
  isActive!: boolean;

  @Field()
  emailVerified!: boolean;

  @Field()
  mobileVerified!: boolean;

  @Field(() => String, { nullable: true })
  signupSource?: string | null;

  @Field(() => Date, { nullable: true })
  lastLogin?: Date | null;

  @Field(() => Date)
  createdAt!: Date;

  @Field(() => Date)
  updatedAt!: Date;

  @Field(() => [Job], { nullable: true })
  jobs?: Job[];

  constructor(partial: Partial<User>) {
    Object.assign(this, partial);
  }
}
