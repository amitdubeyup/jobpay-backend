import { BullModule } from '@nestjs/bull';
import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { GraphQLModule } from '@nestjs/graphql';
import { MercuriusDriver, MercuriusDriverConfig } from '@nestjs/mercurius';
import { join } from 'path';
import { AuthModule } from './auth/auth.module';
import { validateEnv } from './config/env.validation';
import { RedisConfig } from './config/redis.config';
import { HealthModule } from './health/health.module';
import { JobModule } from './job/job.module';
import { PrismaService } from './prisma/prisma.service';
import { RedisModule } from './redis/redis.module';
import { SecurityModule } from './security/security.module';
import { UsersModule } from './users/users.module';
import { ApplicationModule } from './application/application.module';
import { BookmarkModule } from './bookmark/bookmark.module';
import { NotificationModule } from './notification/notification.module';
import { PubSubModule } from './pubsub/pubsub.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      validate: validateEnv,
    }),
    RedisModule,
    PubSubModule,
    GraphQLModule.forRoot<MercuriusDriverConfig>({
      driver: MercuriusDriver,
      graphiql: process.env.GRAPHQL_PLAYGROUND === 'true',
      autoSchemaFile: join(process.cwd(), 'schema.graphql'),
      sortSchema: true,
      subscription: true,
    }),
    BullModule.forRoot({
      redis: RedisConfig.getRedisConfigForBull(),
    }),
    SecurityModule,
    HealthModule,
    JobModule,
    UsersModule,
    AuthModule,
    ApplicationModule,
    BookmarkModule,
    NotificationModule,
  ],
  providers: [PrismaService],
})
export class AppModule {}
