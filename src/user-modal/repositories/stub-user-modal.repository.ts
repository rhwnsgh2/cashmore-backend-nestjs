import {
  IUserModalRepository,
  UserModal,
} from '../interfaces/user-modal-repository.interface';

export class StubUserModalRepository implements IUserModalRepository {
  private modals = new Map<string, UserModal[]>();

  setModals(userId: string, modals: UserModal[]): void {
    this.modals.set(userId, modals);
  }

  clear(): void {
    this.modals.clear();
  }

  findPendingByUserId(userId: string): Promise<UserModal[]> {
    const userModals = this.modals.get(userId) || [];
    const pendingModals = userModals.filter(
      (modal) => modal.status === 'pending',
    );
    return Promise.resolve(pendingModals);
  }
}
