import {
  IUserModalRepository,
  UserModal,
  UserModalType,
} from '../interfaces/user-modal-repository.interface';

export class StubUserModalRepository implements IUserModalRepository {
  private modals = new Map<string, UserModal[]>();
  private nextId = 1;

  setModals(userId: string, modals: UserModal[]): void {
    this.modals.set(userId, modals);
  }

  clear(): void {
    this.modals.clear();
    this.nextId = 1;
  }

  findPendingByUserId(userId: string): Promise<UserModal[]> {
    const userModals = this.modals.get(userId) || [];
    const pendingModals = userModals.filter(
      (modal) => modal.status === 'pending',
    );
    return Promise.resolve(pendingModals);
  }

  hasModalByName(userId: string, name: UserModalType): Promise<boolean> {
    const userModals = this.modals.get(userId) || [];
    const found = userModals.some((modal) => modal.name === name);
    return Promise.resolve(found);
  }

  createModal(
    userId: string,
    name: UserModalType,
    additionalData?: Record<string, unknown>,
  ): Promise<void> {
    const userModals = this.modals.get(userId) || [];
    userModals.push({
      id: this.nextId++,
      name,
      status: 'pending',
      additionalData: additionalData ?? null,
    });
    this.modals.set(userId, userModals);
    return Promise.resolve();
  }

  completeModal(userId: string, modalId: number): Promise<void> {
    const userModals = this.modals.get(userId) || [];
    const modal = userModals.find((m) => m.id === modalId);
    if (modal) {
      modal.status = 'completed';
    }
    return Promise.resolve();
  }
}
