import { Module } from '@nestjs/common';
import { JobService } from './job.service';
import { JobResolver } from './job.resolver';
import { PrismaService } from '../prisma/prisma.service';

@Module({
  providers: [JobService, JobResolver, PrismaService],
})
export class JobModule {}
