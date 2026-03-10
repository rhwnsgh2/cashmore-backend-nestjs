import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { Test, TestingModule } from '@nestjs/testing';
import { NpsSurveyService } from './nps-survey.service';
import { NPS_SURVEY_REPOSITORY } from './interfaces/nps-survey-repository.interface';
import { USER_MODAL_REPOSITORY } from '../user-modal/interfaces/user-modal-repository.interface';
import { StubNpsSurveyRepository } from './repositories/stub-nps-survey.repository';
import { StubUserModalRepository } from '../user-modal/repositories/stub-user-modal.repository';

describe('NpsSurveyService', () => {
  let service: NpsSurveyService;
  let stubNpsSurveyRepo: StubNpsSurveyRepository;
  let stubUserModalRepo: StubUserModalRepository;

  const userId = 'user-1';

  beforeEach(async () => {
    stubNpsSurveyRepo = new StubNpsSurveyRepository();
    stubUserModalRepo = new StubUserModalRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        NpsSurveyService,
        { provide: NPS_SURVEY_REPOSITORY, useValue: stubNpsSurveyRepo },
        { provide: USER_MODAL_REPOSITORY, useValue: stubUserModalRepo },
      ],
    }).compile();

    service = module.get<NpsSurveyService>(NpsSurveyService);
  });

  afterEach(() => {
    stubNpsSurveyRepo.clear();
    stubUserModalRepo.clear();
  });

  it('이미 nps_survey 모달이 있으면 already_submitted을 반환한다', async () => {
    stubUserModalRepo.setModals(userId, [
      { id: 1, name: 'nps_survey', status: 'pending', additionalData: null },
    ]);

    const result = await service.checkTarget(userId);

    expect(result).toEqual({ need: false, reason: 'already_submitted' });
  });

  it('출금 이력이 없으면 not_target을 반환한다', async () => {
    const result = await service.checkTarget(userId);

    expect(result).toEqual({ need: false, reason: 'not_target' });
  });

  it('마지막 출금이 오늘이면 exchange_today를 반환한다', async () => {
    const now = new Date();
    stubNpsSurveyRepo.setExchangeActions(userId, [
      { pointAmount: -5000, createdAt: now.toISOString() },
    ]);

    const result = await service.checkTarget(userId);

    expect(result).toEqual({ need: false, reason: 'exchange_today' });
  });

  it('총 출금 합계가 1000원 초과이고 오늘 출금이 아니면 target을 반환한다', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    stubNpsSurveyRepo.setExchangeActions(userId, [
      { pointAmount: -800, createdAt: yesterday.toISOString() },
      { pointAmount: -300, createdAt: yesterday.toISOString() },
    ]);

    const result = await service.checkTarget(userId);

    expect(result).toEqual({ need: true, reason: 'target' });
  });

  it('target이면 nps_survey 모달을 생성한다', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    stubNpsSurveyRepo.setExchangeActions(userId, [
      { pointAmount: -2000, createdAt: yesterday.toISOString() },
    ]);

    await service.checkTarget(userId);

    const hasModal = await stubUserModalRepo.hasModalByName(
      userId,
      'nps_survey',
    );
    expect(hasModal).toBe(true);
  });

  it('총 출금 합계가 1000원 이하이면 not_target을 반환한다', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    stubNpsSurveyRepo.setExchangeActions(userId, [
      { pointAmount: -500, createdAt: yesterday.toISOString() },
      { pointAmount: -500, createdAt: yesterday.toISOString() },
    ]);

    const result = await service.checkTarget(userId);

    expect(result).toEqual({ need: false, reason: 'not_target' });
  });

  it('정확히 1000원이면 not_target을 반환한다 (초과만 대상)', async () => {
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);

    stubNpsSurveyRepo.setExchangeActions(userId, [
      { pointAmount: -1000, createdAt: yesterday.toISOString() },
    ]);

    const result = await service.checkTarget(userId);

    expect(result).toEqual({ need: false, reason: 'not_target' });
  });

  it('completed 상태의 nps_survey 모달이 있어도 already_submitted을 반환한다', async () => {
    stubUserModalRepo.setModals(userId, [
      {
        id: 1,
        name: 'nps_survey',
        status: 'completed',
        additionalData: null,
      },
    ]);

    const result = await service.checkTarget(userId);

    expect(result).toEqual({ need: false, reason: 'already_submitted' });
  });

  it('다른 모달만 있으면 nps_survey와 무관하게 판단한다', async () => {
    stubUserModalRepo.setModals(userId, [
      { id: 1, name: 'onboarding', status: 'pending', additionalData: null },
    ]);

    const result = await service.checkTarget(userId);

    expect(result).toEqual({ need: false, reason: 'not_target' });
  });
});
