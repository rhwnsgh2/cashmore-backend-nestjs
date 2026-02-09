import { Inject, Injectable, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import firebaseAdmin from 'firebase-admin';
import {
  FCM_REPOSITORY,
  type IFcmRepository,
} from './interfaces/fcm-repository.interface';

export type RefreshMessageType =
  | 'receipt_update'
  | 'point_update'
  | 'step_reward'
  | 'attendance'
  | 'promotion'
  | 'coupang'
  | 'home'
  | 'lottery_update'
  | 'collect_diagnostic_stepcount';

@Injectable()
export class FcmService implements OnModuleInit {
  private isInitialized = false;

  constructor(
    private configService: ConfigService,
    @Inject(FCM_REPOSITORY)
    private fcmRepository: IFcmRepository,
  ) {}

  onModuleInit() {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    if (firebaseAdmin.apps && firebaseAdmin.apps.length > 0) {
      this.isInitialized = true;
      return;
    }

    const projectId = this.configService.get<string>('FIREBASE_PROJECT_ID');
    const clientEmail = this.configService.get<string>('FIREBASE_CLIENT_EMAIL');
    const privateKey = this.configService.get<string>('FIREBASE_PRIVATE_KEY');

    if (!projectId || !clientEmail || !privateKey) {
      console.warn(
        '[FCM] Firebase credentials not configured. FCM will be disabled.',
      );
      return;
    }

    try {
      firebaseAdmin.initializeApp({
        credential: firebaseAdmin.credential.cert({
          projectId,
          clientEmail,
          privateKey: privateKey.replace(/\\n/g, '\n'),
        }),
      });
      this.isInitialized = true;
      console.log('[FCM] Firebase Admin SDK initialized successfully');
    } catch (error) {
      console.error('[FCM] Firebase initialization failed:', error);
    }
  }

  async sendRefreshMessage(
    userId: string,
    refreshMessage: RefreshMessageType,
  ): Promise<void> {
    if (!this.isInitialized) {
      return;
    }

    const fcmToken = await this.fcmRepository.findFcmToken(userId);

    if (!fcmToken) {
      console.warn(`[FCM] No FCM token found for user: ${userId}`);
      return;
    }

    try {
      if (refreshMessage === 'collect_diagnostic_stepcount') {
        await firebaseAdmin.messaging().send({
          token: fcmToken,
          data: {
            messageType: 'collect_diagnostic',
            target: 'stepcount',
          },
        });
        return;
      }

      await firebaseAdmin.messaging().send({
        token: fcmToken,
        data: {
          messageType: 'refresh',
          target: refreshMessage,
        },
      });
    } catch (error) {
      console.error(
        `[FCM] Failed to send message to user ${userId}:`,
        error instanceof Error ? error.message : error,
      );
    }
  }
}
