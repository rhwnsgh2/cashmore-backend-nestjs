import { Inject, Injectable } from '@nestjs/common';
import type { IEventPointRepository } from './interfaces/event-point-repository.interface';
import {
  EVENT_POINT_REPOSITORY,
  EventPoint,
} from './interfaces/event-point-repository.interface';

@Injectable()
export class EventPointService {
  constructor(
    @Inject(EVENT_POINT_REPOSITORY)
    private eventPointRepository: IEventPointRepository,
  ) {}

  async getEventPoints(userId: string): Promise<EventPoint[]> {
    return this.eventPointRepository.findByUserId(userId);
  }
}
