import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Bookmark, BookmarkResult } from './bookmark.entity';
import { User as UserEntity } from '../users/user.entity';
import { Job } from '../job/job.entity';

@Injectable()
export class BookmarkService {
  constructor(private prisma: PrismaService) {}

  async toggleBookmark(userId: string, jobId: number): Promise<BookmarkResult> {
    // Check if job exists
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, isActive: true },
    });

    if (!job || !job.isActive) {
      throw new NotFoundException('Job not found');
    }

    // Check if already bookmarked
    const existing = await this.prisma.bookmark.findUnique({
      where: {
        userId_jobId: {
          userId: BigInt(userId),
          jobId,
        },
      },
    });

    if (existing) {
      // Remove bookmark
      await this.prisma.bookmark.delete({
        where: { id: existing.id },
      });
      return { success: true, isBookmarked: false };
    } else {
      // Add bookmark
      await this.prisma.bookmark.create({
        data: {
          userId: BigInt(userId),
          jobId,
        },
      });
      return { success: true, isBookmarked: true };
    }
  }

  async addBookmark(userId: string, jobId: number): Promise<Bookmark> {
    // Check if job exists
    const job = await this.prisma.job.findUnique({
      where: { id: jobId },
      select: { id: true, isActive: true },
    });

    if (!job || !job.isActive) {
      throw new NotFoundException('Job not found');
    }

    const bookmark = await this.prisma.bookmark.upsert({
      where: {
        userId_jobId: {
          userId: BigInt(userId),
          jobId,
        },
      },
      update: {}, // No update needed, just return existing
      create: {
        userId: BigInt(userId),
        jobId,
      },
      include: {
        job: { include: { poster: true } },
      },
    });

    return this.mapToEntity(bookmark);
  }

  async removeBookmark(userId: string, jobId: number): Promise<boolean> {
    try {
      await this.prisma.bookmark.delete({
        where: {
          userId_jobId: {
            userId: BigInt(userId),
            jobId,
          },
        },
      });
      return true;
    } catch {
      return false; // Bookmark didn't exist
    }
  }

  async getMyBookmarks(userId: string): Promise<Bookmark[]> {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId: BigInt(userId) },
      include: {
        job: { include: { poster: true } },
      },
      orderBy: { createdAt: 'desc' },
    });

    return bookmarks.map(this.mapToEntity);
  }

  async isBookmarked(userId: string, jobId: number): Promise<boolean> {
    const bookmark = await this.prisma.bookmark.findUnique({
      where: {
        userId_jobId: {
          userId: BigInt(userId),
          jobId,
        },
      },
    });
    return !!bookmark;
  }

  async getBookmarkedJobIds(userId: string): Promise<number[]> {
    const bookmarks = await this.prisma.bookmark.findMany({
      where: { userId: BigInt(userId) },
      select: { jobId: true },
    });
    return bookmarks.map(b => b.jobId);
  }

  private mapToEntity(bookmark: any): Bookmark {
    return {
      id: bookmark.id,
      userId: bookmark.userId.toString(),
      jobId: bookmark.jobId,
      createdAt: bookmark.createdAt,
      job: {
        ...bookmark.job,
        posterId: bookmark.job.posterId.toString(),
        poster: new UserEntity({
          ...bookmark.job.poster,
          id: bookmark.job.poster.id.toString(),
          password: undefined,
        }),
      } as Job,
    };
  }
}
