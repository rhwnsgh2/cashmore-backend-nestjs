import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PubSub } from '@google-cloud/pubsub';

export interface ReceiptQueueMessage {
  imageUrl: string;
  userId: string;
  everyReceiptId: number;
}

@Injectable()
export class ReceiptQueueService {
  private readonly logger = new Logger(ReceiptQueueService.name);
  private readonly pubsub: PubSub;
  private static readonly TOPIC = 'every-receipt-queue-v2';

  constructor(private configService: ConfigService) {
    this.pubsub = new PubSub({
      projectId: this.configService.get<string>('gcs.projectId'),
      credentials: {
        client_email: this.configService.get<string>('gcs.clientEmail'),
        private_key: this.configService
          .get<string>('gcs.privateKey')
          ?.replace(/\\n/g, '\n'),
      },
    });
  }

  async publish(message: ReceiptQueueMessage): Promise<string> {
    const topic = this.pubsub.topic(ReceiptQueueService.TOPIC);
    const dataBuffer = Buffer.from(JSON.stringify(message));

    const messageId = await topic.publishMessage({ data: dataBuffer });
    this.logger.log(
      `PubSub 메시지 발행 완료. messageId=${messageId}, userId=${message.userId}, receiptId=${message.everyReceiptId}`,
    );
    return messageId;
  }
}
