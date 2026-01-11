import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { User as UserEntity } from '../users/user.entity';
import { CreateJobInput } from './dto/create-job.input';
import { Job } from './job.entity';

@Injectable()
export class JobService {
  constructor(private prisma: PrismaService) {}

  async create(createJobInput: CreateJobInput): Promise<Job> {
    const job = await this.prisma.job.create({
      data: {
        title: createJobInput.title,
        budget: createJobInput.budget,
        posterId: BigInt(createJobInput.posterId), // Convert string to BigInt
        description: createJobInput.description || null,
        status: 'OPEN',
        skills: createJobInput.skills || [],
        isActive: true,
      },
      include: {
        poster: true,
      },
    });

    const mappedJob = this.mapPrismaJobToEntity(job);

    return mappedJob;
  }

  async findAll(): Promise<Job[]> {
    const jobs = await this.prisma.job.findMany({
      where: {
        isActive: true,
      },
      include: {
        poster: true,
      },
    });

    return jobs.map(job => this.mapPrismaJobToEntity(job));
  }

  private mapPrismaJobToEntity(job: {
    id: number;
    title: string;
    description?: string | null;
    budget: number;
    status: string;
    skills: string[];
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
    deletedAt?: Date | null;
    posterId: bigint;
    poster: {
      id: bigint;
      email: string;
      firstName?: string | null;
      lastName?: string | null;
      role: string;
      isActive: boolean;
      createdAt: Date;
      updatedAt: Date;
    };
  }): Job {
    const { poster, ...jobData } = job;
    return {
      ...jobData,
      posterId: poster.id.toString(), // Convert BigInt to string
      poster: new UserEntity({
        ...poster,
        id: poster.id.toString(), // Convert BigInt to string
        password: undefined,
        identityStatus: false,
        emailVerified: false,
        mobileVerified: false,
        role: poster.role as any,
      }),
    };
  }
}
