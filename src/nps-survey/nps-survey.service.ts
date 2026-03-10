import { Inject, Injectable } from '@nestjs/common';
import type { INpsSurveyRepository } from './interfaces/nps-survey-repository.interface';
import { NPS_SURVEY_REPOSITORY } from './interfaces/nps-survey-repository.interface';
import type { IUserModalRepository } from '../user-modal/interfaces/user-modal-repository.interface';
import { USER_MODAL_REPOSITORY } from '../user-modal/interfaces/user-modal-repository.interface';
import { NpsSurveyTargetResponseDto } from './dto/nps-survey-target.dto';
import dayjs from 'dayjs';
import utc from 'dayjs/plugin/utc';
import timezone from 'dayjs/plugin/timezone';

dayjs.extend(utc);
dayjs.extend(timezone);

@Injectable()
export class NpsSurveyService {
  constructor(
    @Inject(NPS_SURVEY_REPOSITORY)
    private npsSurveyRepository: INpsSurveyRepository,
    @Inject(USER_MODAL_REPOSITORY)
    private userModalRepository: IUserModalRepository,
  ) {}

  async checkTarget(userId: string): Promise<NpsSurveyTargetResponseDto> {
    const alreadySubmitted = await this.userModalRepository.hasModalByName(
      userId,
      'nps_survey',
    );

    if (alreadySubmitted) {
      return { need: false, reason: 'already_submitted' };
    }

    const exchangeActions =
      await this.npsSurveyRepository.findDoneExchangeActions(userId);

    if (exchangeActions.length === 0) {
      return { need: false, reason: 'not_target' };
    }

    const lastExchangeDate = dayjs(exchangeActions[0].createdAt).tz(
      'Asia/Seoul',
    );
    const today = dayjs().tz('Asia/Seoul');

    if (lastExchangeDate.isSame(today, 'day')) {
      return { need: false, reason: 'exchange_today' };
    }

    const totalExchanged = Math.abs(
      exchangeActions.reduce((acc, curr) => acc + curr.pointAmount, 0),
    );

    if (totalExchanged > 1000) {
      await this.userModalRepository.createModal(userId, 'nps_survey');
      return { need: true, reason: 'target' };
    }

    return { need: false, reason: 'not_target' };
  }
}
