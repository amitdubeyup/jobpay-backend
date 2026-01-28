import { Field, InputType, Int, registerEnumType } from '@nestjs/graphql';
import {
  IsArray,
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
} from 'class-validator';

export enum JobSortField {
  CREATED_AT = 'createdAt',
  BUDGET = 'budget',
  TITLE = 'title',
}

export enum SortOrder {
  ASC = 'asc',
  DESC = 'desc',
}

registerEnumType(JobSortField, {
  name: 'JobSortField',
  description: 'Fields available for sorting jobs',
});

registerEnumType(SortOrder, {
  name: 'SortOrder',
  description: 'Sort order direction',
});

@InputType()
export class JobFilterInput {
  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  search?: string; // Search in title and description

  @Field(() => [String], { nullable: true })
  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  skills?: string[]; // Filter by skills (OR match)

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Min(0)
  budgetMin?: number;

  @Field(() => Int, { nullable: true })
  @IsOptional()
  @IsInt()
  @Max(100000000)
  budgetMax?: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  status?: string; // OPEN, IN_PROGRESS, etc.

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  posterId?: string; // Filter by employer

  @Field(() => JobSortField, { nullable: true, defaultValue: JobSortField.CREATED_AT })
  @IsOptional()
  @IsEnum(JobSortField)
  sortBy?: JobSortField;

  @Field(() => SortOrder, { nullable: true, defaultValue: SortOrder.DESC })
  @IsOptional()
  @IsEnum(SortOrder)
  sortOrder?: SortOrder;
}

@InputType()
export class PaginationInput {
  @Field(() => Int, { nullable: true, defaultValue: 20 })
  @IsOptional()
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number;

  @Field(() => Int, { nullable: true, defaultValue: 0 })
  @IsOptional()
  @IsInt()
  @Min(0)
  offset?: number;
}
