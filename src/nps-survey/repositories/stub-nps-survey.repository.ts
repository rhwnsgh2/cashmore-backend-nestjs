import {
  CreateNpsSurveyInput,
  ExchangeAction,
  INpsSurveyRepository,
} from '../interfaces/nps-survey-repository.interface';

export class StubNpsSurveyRepository implements INpsSurveyRepository {
  private exchangeActions = new Map<string, ExchangeAction[]>();
  private createdSurveys: CreateNpsSurveyInput[] = [];

  setExchangeActions(userId: string, actions: ExchangeAction[]): void {
    this.exchangeActions.set(userId, actions);
  }

  getCreatedSurveys(): CreateNpsSurveyInput[] {
    return this.createdSurveys;
  }

  clear(): void {
    this.exchangeActions.clear();
    this.createdSurveys = [];
  }

  findDoneExchangeActions(userId: string): Promise<ExchangeAction[]> {
    return Promise.resolve(this.exchangeActions.get(userId) || []);
  }

  createNpsSurvey(input: CreateNpsSurveyInput): Promise<void> {
    this.createdSurveys.push({ ...input });
    return Promise.resolve();
  }
}
