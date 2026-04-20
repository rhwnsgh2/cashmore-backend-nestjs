export interface ExchangeAction {
  pointAmount: number;
  createdAt: string;
}

export interface CreateNpsSurveyInput {
  userId: string;
  score: number;
  feedback?: string;
}

export interface INpsSurveyRepository {
  findDoneExchangeActions(userId: string): Promise<ExchangeAction[]>;
  createNpsSurvey(input: CreateNpsSurveyInput): Promise<void>;
}

export const NPS_SURVEY_REPOSITORY = Symbol('NPS_SURVEY_REPOSITORY');
