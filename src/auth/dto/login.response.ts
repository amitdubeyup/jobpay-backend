import { Field, ObjectType } from '@nestjs/graphql';
import { User } from '../../users/user.entity';

@ObjectType()
export class LoginResponse {
  @Field()
  accessToken!: string;

  @Field(() => User)
  user!: User;
}
