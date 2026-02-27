import {
  ConflictException,
  Inject,
  Injectable,
  Logger,
} from '@nestjs/common';
import { BuzzvilApiService } from './buzzvil-api.service';
import { AuthService } from '../auth/auth.service';
import { GetAdsQueryDto } from './dto/get-ads.dto';
import { ParticipateRequestDto } from './dto/participate.dto';
import { PostbackBodyDto } from './dto/postback.dto';
import {
  BUZZVIL_REPOSITORY,
  type IBuzzvilRepository,
} from './interfaces/buzzvil-repository.interface';

const DEFAULT_IFA = '00000000-0000-0000-0000-000000000000';

@Injectable()
export class BuzzvilService {
  private readonly logger = new Logger(BuzzvilService.name);

  constructor(
    private buzzvilApiService: BuzzvilApiService,
    private authService: AuthService,
    @Inject(BUZZVIL_REPOSITORY)
    private buzzvilRepository: IBuzzvilRepository,
  ) {}

  async getAds(authId: string, clientIp: string, query: GetAdsQueryDto) {
    return this.buzzvilApiService.getAds({
      userId: authId,
      clientIp,
      ifa: query.ifa || DEFAULT_IFA,
      platform: query.platform,
      birthday: query.birthday,
      gender: query.gender,
      carrier: query.carrier,
      deviceName: query.device_name,
      userAgent: query.user_agent,
      cursor: query.cursor,
    });
  }

  async participate(
    authId: string,
    clientIp: string,
    dto: ParticipateRequestDto,
  ) {
    return this.buzzvilApiService.participate({
      userId: authId,
      clientIp,
      ifa: dto.ifa || DEFAULT_IFA,
      platform: dto.platform,
      campaignId: dto.campaign_id,
      payload: dto.payload,
      deviceName: dto.device_name,
      carrier: dto.carrier,
    });
  }

  async handlePostback(dto: PostbackBodyDto): Promise<{ message: string }> {
    // 1. 중복 체크
    const exists = await this.buzzvilRepository.existsByTransactionId(
      dto.transaction_id,
    );
    if (exists) {
      throw new ConflictException('Duplicate transaction_id');
    }

    // 2. auth_id → user_id 매핑
    const userId = await this.authService.getUserIdByAuthId(dto.user_id);
    if (!userId) {
      this.logger.warn(
        `Postback for unknown auth_id: ${dto.user_id}, transaction_id: ${dto.transaction_id}`,
      );
      return { message: 'OK' };
    }

    // 3. 포인트 저장 (Buzzvil 포인트 그대로 적립)
    const pointAmount = Number(dto.point);

    await this.buzzvilRepository.insertPointAction({
      user_id: userId,
      type: 'BUZZVIL_REWARD',
      point_amount: pointAmount,
      status: 'done',
      additional_data: {
        transaction_id: dto.transaction_id,
        campaign_id: Number(dto.campaign_id),
        action_type: dto.action_type,
        revenue_type: dto.revenue_type,
        title: dto.title || '',
        unit_id: dto.unit_id,
        event_at: Number(dto.event_at),
      },
    });

    this.logger.log(
      `Postback processed: auth_id=${dto.user_id}, user_id=${userId}, point=${pointAmount}, campaign_id=${dto.campaign_id}`,
    );

    return { message: 'OK' };
  }

  async getRewardStatus(userId: string, campaignId: number) {
    const reward = await this.buzzvilRepository.findRewardByCampaignId(
      userId,
      campaignId,
    );
    if (!reward) {
      return { credited: false };
    }
    return { credited: true, point: reward.point_amount };
  }
}
