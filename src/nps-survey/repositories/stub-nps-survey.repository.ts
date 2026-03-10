import {
  ExchangeAction,
  INpsSurveyRepository,
} from '../interfaces/nps-survey-repository.interface';

export class StubNpsSurveyRepository implements INpsSurveyRepository {
  private exchangeActions = new Map<string, ExchangeAction[]>();

  setExchangeActions(userId: string, actions: ExchangeAction[]): void {
    this.exchangeActions.set(userId, actions);
  }

  clear(): void {
    this.exchangeActions.clear();
  }

  findDoneExchangeActions(userId: string): Promise<ExchangeAction[]> {
    return Promise.resolve(this.exchangeActions.get(userId) || []);
  }
}
