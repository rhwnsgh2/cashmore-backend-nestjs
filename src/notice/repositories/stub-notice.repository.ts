import type {
  INoticeRepository,
  Notice,
} from '../interfaces/notice-repository.interface';

export class StubNoticeRepository implements INoticeRepository {
  private notices: Notice[] = [];

  setNotices(notices: Notice[]): void {
    this.notices = notices;
  }

  clear(): void {
    this.notices = [];
  }

  findVisible(): Promise<Notice[]> {
    const visible = this.notices
      .filter((n) => n.is_visible)
      .sort(
        (a, b) =>
          new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
      );
    return Promise.resolve(visible);
  }
}
