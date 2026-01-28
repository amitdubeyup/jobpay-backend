import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Application, ApplicationStatus } from './application.entity';
import { CreateApplicationInput, UpdateApplicationStatusInput } from './dto/application.input';
import { User as UserEntity } from '../users/user.entity';
import { Job } from '../job/job.entity';

@Injectable()
export class ApplicationService {
  constructor(private prisma: PrismaService) {}

  async apply(userId: string, input: CreateApplicationInput): Promise<Application> {
    // Check if job exists and is open
    const job = await this.prisma.job.findUnique({
      where: { id: input.jobId },
      select: { id: true, status: true, posterId: true, isActive: true },
    });

    if (!job || !job.isActive) {
      throw new NotFoundException('Job not found');
    }

    if (job.status !== 'OPEN') {
      throw new BadRequestException('Job is no longer accepting applications');
    }

    // Prevent self-application
    if (job.posterId.toString() === userId) {
      throw new BadRequestException('You cannot apply to your own job');
    }

    // Check for existing application
    const existing = await this.prisma.application.findUnique({
      where: {
        applicantId_jobId: {
          applicantId: BigInt(userId),
          jobId: input.jobId,
        },
      },
    });

    if (existing) {
      if (existing.status === 'WITHDRAWN') {
        // Allow re-application after withdrawal
        const updated = await this.prisma.application.update({
          where: { id: existing.id },
          data: {
            status: 'PENDING',
            coverLetter: input.coverLetter,
            resumeUrl: input.resumeUrl,
            appliedAt: new Date(),
          },
          include: {
            applicant: true,
            job: { include: { poster: true } },
          },
        });
        return this.mapToEntity(updated);
      }
      throw new ConflictException('You have already applied to this job');
    }

    const application = await this.prisma.application.create({
      data: {
        applicantId: BigInt(userId),
        jobId: input.jobId,
        coverLetter: input.coverLetter,
        resumeUrl: input.resumeUrl,
        status: 'PENDING',
      },
      include: {
        applicant: true,
        job: { include: { poster: true } },
      },
    });

    return this.mapToEntity(application);
  }

  async withdraw(userId: string, applicationId: number): Promise<Application> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      select: { id: true, applicantId: true, status: true },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    if (application.applicantId.toString() !== userId) {
      throw new ForbiddenException('You can only withdraw your own applications');
    }

    if (['ACCEPTED', 'REJECTED', 'WITHDRAWN'].includes(application.status)) {
      throw new BadRequestException('Cannot withdraw this application');
    }

    const updated = await this.prisma.application.update({
      where: { id: applicationId },
      data: { status: 'WITHDRAWN' },
      include: {
        applicant: true,
        job: { include: { poster: true } },
      },
    });

    return this.mapToEntity(updated);
  }

  async updateStatus(
    userId: string,
    input: UpdateApplicationStatusInput,
  ): Promise<Application> {
    const application = await this.prisma.application.findUnique({
      where: { id: input.applicationId },
      include: {
        job: { select: { posterId: true } },
      },
    });

    if (!application) {
      throw new NotFoundException('Application not found');
    }

    // Only job poster can update status
    if (application.job.posterId.toString() !== userId) {
      throw new ForbiddenException('Only the job poster can update application status');
    }

    // Validate status transitions
    const allowedTransitions: Record<string, string[]> = {
      PENDING: ['REVIEWED', 'SHORTLISTED', 'REJECTED'],
      REVIEWED: ['SHORTLISTED', 'REJECTED'],
      SHORTLISTED: ['ACCEPTED', 'REJECTED'],
      ACCEPTED: [],
      REJECTED: [],
      WITHDRAWN: [],
    };

    if (!allowedTransitions[application.status]?.includes(input.status)) {
      throw new BadRequestException(
        `Cannot transition from ${application.status} to ${input.status}`,
      );
    }

    const updated = await this.prisma.application.update({
      where: { id: input.applicationId },
      data: {
        status: input.status,
        notes: input.notes,
        reviewedAt: new Date(),
      },
      include: {
        applicant: true,
        job: { include: { poster: true } },
      },
    });

    return this.mapToEntity(updated);
  }

  async getMyApplications(userId: string): Promise<Application[]> {
    const applications = await this.prisma.application.findMany({
      where: { applicantId: BigInt(userId) },
      include: {
        applicant: true,
        job: { include: { poster: true } },
      },
      orderBy: { appliedAt: 'desc' },
    });

    return applications.map(this.mapToEntity);
  }

  async getJobApplications(userId: string, jobId: number): Promise<Application[]> {
    // Verify user owns the job
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { posterId: true },
    });

    if (!job || job.posterId.toString() !== userId) {
      throw new NotFoundException('Job not found');
    }

    const applications = await this.prisma.application.findMany({
      where: { jobId },
      include: {
        applicant: true,
        job: { include: { poster: true } },
      },
      orderBy: { appliedAt: 'desc' },
    });

    return applications.map(this.mapToEntity);
  }

  async getApplicationById(
    userId: string,
    applicationId: number,
  ): Promise<Application | null> {
    const application = await this.prisma.application.findUnique({
      where: { id: applicationId },
      include: {
        applicant: true,
        job: { include: { poster: true } },
      },
    });

    if (!application) return null;

    // Only applicant or job poster can view
    const isApplicant = application.applicantId.toString() === userId;
    const isJobPoster = application.job.posterId.toString() === userId;

    if (!isApplicant && !isJobPoster) {
      return null;
    }

    return this.mapToEntity(application);
  }

  private mapToEntity(app: any): Application {
    return {
      id: app.id,
      coverLetter: app.coverLetter,
      resumeUrl: app.resumeUrl,
      status: app.status as ApplicationStatus,
      appliedAt: app.appliedAt,
      updatedAt: app.updatedAt,
      reviewedAt: app.reviewedAt,
      applicantId: app.applicantId.toString(),
      jobId: app.jobId,
      applicant: new UserEntity({
        ...app.applicant,
        id: app.applicant.id.toString(),
        password: undefined,
      }),
      job: {
        ...app.job,
        posterId: app.job.posterId.toString(),
        poster: new UserEntity({
          ...app.job.poster,
          id: app.job.poster.id.toString(),
          password: undefined,
        }),
      } as Job,
    };
  }
}
