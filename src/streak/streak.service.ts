import { Inject, Injectable } from '@nestjs/common';
import type {
  IStreakRepository,
  Streak,
} from './interfaces/streak-repository.interface';
import { STREAK_REPOSITORY } from './interfaces/streak-repository.interface';

@Injectable()
export class StreakService {
  constructor(
    @Inject(STREAK_REPOSITORY)
    private streakRepository: IStreakRepository,
  ) {}

  async getAllStreaks(userId: string): Promise<Streak[]> {
    return await this.streakRepository.findStreaks(userId);
  }
}
