import { Field, InputType, Int } from '@nestjs/graphql';
import {
  ArrayMaxSize,
  IsArray,
  IsInt,
  IsNotEmpty,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

@InputType()
export class CreateJobInput {
  @Field()
  @IsNotEmpty()
  @IsString()
  @MinLength(3, { message: 'Title must be at least 3 characters' })
  @MaxLength(200, { message: 'Title must not exceed 200 characters' })
  title!: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Description must not exceed 5000 characters' })
  description?: string;

  @Field(() => Int)
  @IsNumber()
  @IsInt()
  @Min(1, { message: 'Budget must be at least 1' })
  @Max(100000000, { message: 'Budget must not exceed 100,000,000' })
  budget!: number;

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20, { message: 'Maximum 20 skills allowed' })
  @IsString({ each: true })
  @MaxLength(50, { each: true, message: 'Each skill must not exceed 50 characters' })
  skills?: string[];

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  posterId?: string; // BigInt as string - will be overridden by auth user
}
