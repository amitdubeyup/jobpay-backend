import { Args, Int, Mutation, Query, Resolver } from '@nestjs/graphql';
import { UseGuards } from '@nestjs/common';
import { BookmarkService } from './bookmark.service';
import { Bookmark, BookmarkResult } from './bookmark.entity';
import { GqlAuthGuard } from '../auth/guards/gql-auth.guard';
import { CurrentUser } from '../auth/decorators/current-user.decorator';
import { User } from '../users/user.entity';

@Resolver(() => Bookmark)
export class BookmarkResolver {
  constructor(private readonly bookmarkService: BookmarkService) {}

  @Mutation(() => BookmarkResult)
  @UseGuards(GqlAuthGuard)
  async toggleBookmark(
    @Args('jobId', { type: () => Int }) jobId: number,
    @CurrentUser() user: User,
  ): Promise<BookmarkResult> {
    return this.bookmarkService.toggleBookmark(user.id, jobId);
  }

  @Mutation(() => Bookmark)
  @UseGuards(GqlAuthGuard)
  async bookmarkJob(
    @Args('jobId', { type: () => Int }) jobId: number,
    @CurrentUser() user: User,
  ): Promise<Bookmark> {
    return this.bookmarkService.addBookmark(user.id, jobId);
  }

  @Mutation(() => Boolean)
  @UseGuards(GqlAuthGuard)
  async unbookmarkJob(
    @Args('jobId', { type: () => Int }) jobId: number,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.bookmarkService.removeBookmark(user.id, jobId);
  }

  @Query(() => [Bookmark], { name: 'myBookmarks' })
  @UseGuards(GqlAuthGuard)
  async myBookmarks(@CurrentUser() user: User): Promise<Bookmark[]> {
    return this.bookmarkService.getMyBookmarks(user.id);
  }

  @Query(() => Boolean, { name: 'isJobBookmarked' })
  @UseGuards(GqlAuthGuard)
  async isJobBookmarked(
    @Args('jobId', { type: () => Int }) jobId: number,
    @CurrentUser() user: User,
  ): Promise<boolean> {
    return this.bookmarkService.isBookmarked(user.id, jobId);
  }

  @Query(() => [Int], { name: 'bookmarkedJobIds' })
  @UseGuards(GqlAuthGuard)
  async bookmarkedJobIds(@CurrentUser() user: User): Promise<number[]> {
    return this.bookmarkService.getBookmarkedJobIds(user.id);
  }
}
