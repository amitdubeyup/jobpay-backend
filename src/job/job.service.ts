import { Injectable, NotFoundException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { User as UserEntity } from '../users/user.entity';
import { CreateJobInput } from './dto/create-job.input';
import { JobFilterInput, PaginationInput } from './dto/job-filter.input';
import { Job } from './job.entity';

@Injectable()
export class JobService {
  constructor(private prisma: PrismaService) {}

  async create(createJobInput: CreateJobInput): Promise<Job> {
    const job = await this.prisma.job.create({
      data: {
        title: createJobInput.title,
        budget: createJobInput.budget,
        posterId: BigInt(createJobInput.posterId),
        description: createJobInput.description || null,
        status: 'OPEN',
        skills: createJobInput.skills || [],
        isActive: true,
      },
      include: {
        poster: true,
      },
    });

    return this.mapPrismaJobToEntity(job);
  }

  async findAll(limit: number = 20, offset: number = 0): Promise<Job[]> {
    const jobs = await this.prisma.job.findMany({
      where: {
        isActive: true,
      },
      include: {
        poster: true,
      },
      take: limit,
      skip: offset,
      orderBy: {
        createdAt: 'desc',
      },
    });

    return jobs.map(job => this.mapPrismaJobToEntity(job));
  }

  async search(
    filter: JobFilterInput,
    pagination: PaginationInput,
  ): Promise<{ jobs: Job[]; total: number }> {
    const where: Prisma.JobWhereInput = {
      isActive: true,
      deletedAt: null,
    };

    // Search in title and description
    if (filter.search) {
      where.OR = [
        { title: { contains: filter.search, mode: 'insensitive' } },
        { description: { contains: filter.search, mode: 'insensitive' } },
      ];
    }

    // Filter by skills (job must have at least one of the specified skills)
    if (filter.skills && filter.skills.length > 0) {
      where.skills = {
        hasSome: filter.skills,
      };
    }

    // Filter by budget range
    if (filter.budgetMin !== undefined || filter.budgetMax !== undefined) {
      where.budget = {};
      if (filter.budgetMin !== undefined) {
        where.budget.gte = filter.budgetMin;
      }
      if (filter.budgetMax !== undefined) {
        where.budget.lte = filter.budgetMax;
      }
    }

    // Filter by status
    if (filter.status) {
      where.status = filter.status as any;
    }

    // Filter by poster (employer)
    if (filter.posterId) {
      where.posterId = BigInt(filter.posterId);
    }

    // Build orderBy
    const orderBy: Prisma.JobOrderByWithRelationInput = {};
    const sortField = filter.sortBy || 'createdAt';
    const sortOrder = filter.sortOrder || 'desc';
    orderBy[sortField] = sortOrder;

    // Execute queries in parallel
    const [jobs, total] = await Promise.all([
      this.prisma.job.findMany({
        where,
        include: {
          poster: true,
          _count: {
            select: {
              applications: true,
              bookmarks: true,
            },
          },
        },
        take: pagination.limit || 20,
        skip: pagination.offset || 0,
        orderBy,
      }),
      this.prisma.job.count({ where }),
    ]);

    return {
      jobs: jobs.map(job => this.mapPrismaJobToEntity(job)),
      total,
    };
  }

  async findById(id: number): Promise<Job | null> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      include: {
        poster: true,
        _count: {
          select: {
            applications: true,
            bookmarks: true,
          },
        },
      },
    });

    if (!job) return null;
    return this.mapPrismaJobToEntity(job);
  }

  async findByPosterId(posterId: string): Promise<Job[]> {
    const jobs = await this.prisma.job.findMany({
      where: {
        posterId: BigInt(posterId),
        isActive: true,
      },
      include: {
        poster: true,
        _count: {
          select: {
            applications: true,
            bookmarks: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return jobs.map(job => this.mapPrismaJobToEntity(job));
  }

  async updateStatus(id: number, status: string, userId: string): Promise<Job> {
    const job = await this.prisma.job.findUnique({
      where: { id },
      select: { posterId: true },
    });

    if (!job) {
      throw new NotFoundException('Job not found');
    }

    if (job.posterId.toString() !== userId) {
      throw new NotFoundException('Job not found'); // Don't reveal existence
    }

    const updated = await this.prisma.job.update({
      where: { id },
      data: { status: status as any },
      include: { poster: true },
    });

    return this.mapPrismaJobToEntity(updated);
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
    _count?: {
      applications?: number;
      bookmarks?: number;
    };
  }): Job {
    const { poster, _count, ...jobData } = job;
    return {
      ...jobData,
      posterId: poster.id.toString(),
      poster: new UserEntity({
        ...poster,
        id: poster.id.toString(),
        password: undefined,
        identityStatus: false,
        emailVerified: false,
        mobileVerified: false,
        role: poster.role as any,
      }),
      applicationCount: _count?.applications || 0,
      bookmarkCount: _count?.bookmarks || 0,
    };
  }
}
