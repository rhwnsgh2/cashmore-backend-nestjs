import { Inject, Injectable } from '@nestjs/common';
import type { IUserModalRepository } from './interfaces/user-modal-repository.interface';
import {
  USER_MODAL_REPOSITORY,
  UserModal,
  UserModalType,
} from './interfaces/user-modal-repository.interface';

export interface GetUserModalsResult {
  success: boolean;
  modals: UserModal[];
}

@Injectable()
export class UserModalService {
  constructor(
    @Inject(USER_MODAL_REPOSITORY)
    private userModalRepository: IUserModalRepository,
  ) {}

  async completeModal(
    userId: string,
    modalId: number,
  ): Promise<{ success: boolean }> {
    await this.userModalRepository.completeModal(userId, modalId);
    return { success: true };
  }

  async getPendingModals(userId: string): Promise<GetUserModalsResult> {
    const modals = await this.userModalRepository.findPendingByUserId(userId);

    return {
      success: true,
      modals,
    };
  }

  async createModal(
    userId: string,
    name: UserModalType,
    additionalData?: Record<string, unknown>,
  ): Promise<void> {
    await this.userModalRepository.createModal(userId, name, additionalData);
  }
}
