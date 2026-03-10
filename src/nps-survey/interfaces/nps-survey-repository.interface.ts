export interface ExchangeAction {
  pointAmount: number;
  createdAt: string;
}

export interface INpsSurveyRepository {
  findDoneExchangeActions(userId: string): Promise<ExchangeAction[]>;
}

export const NPS_SURVEY_REPOSITORY = Symbol('NPS_SURVEY_REPOSITORY');
