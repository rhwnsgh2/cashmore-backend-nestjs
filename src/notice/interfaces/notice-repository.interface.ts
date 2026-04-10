export interface Notice {
  id: number;
  created_at: string;
  updated_at: string;
  title: string;
  content: string;
  is_visible: boolean;
}

export interface INoticeRepository {
  findVisible(): Promise<Notice[]>;
}

export const NOTICE_REPOSITORY = Symbol('NOTICE_REPOSITORY');
