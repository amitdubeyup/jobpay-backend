import { Field, InputType, Int } from '@nestjs/graphql';
import {
  IsEnum,
  IsInt,
  IsNotEmpty,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
} from 'class-validator';
import { ApplicationStatus } from '../application.entity';

@InputType()
export class CreateApplicationInput {
  @Field(() => Int)
  @IsNotEmpty()
  @IsInt()
  jobId!: number;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(5000, { message: 'Cover letter must not exceed 5000 characters' })
  coverLetter?: string;

  @Field({ nullable: true })
  @IsOptional()
  @IsUrl({}, { message: 'Resume URL must be a valid URL' })
  @MaxLength(2048)
  resumeUrl?: string;
}

@InputType()
export class UpdateApplicationStatusInput {
  @Field(() => Int)
  @IsNotEmpty()
  @IsInt()
  applicationId!: number;

  @Field(() => ApplicationStatus)
  @IsNotEmpty()
  @IsEnum(ApplicationStatus)
  status!: ApplicationStatus;

  @Field({ nullable: true })
  @IsOptional()
  @IsString()
  @MaxLength(2000, { message: 'Notes must not exceed 2000 characters' })
  notes?: string; // Employer's private notes
}
