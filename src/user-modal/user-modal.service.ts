import { Inject, Injectable } from '@nestjs/common';
import type { IUserModalRepository } from './interfaces/user-modal-repository.interface';
import {
  USER_MODAL_REPOSITORY,
  UserModal,
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

  async getPendingModals(userId: string): Promise<GetUserModalsResult> {
    const modals = await this.userModalRepository.findPendingByUserId(userId);

    return {
      success: true,
      modals,
    };
  }
}
