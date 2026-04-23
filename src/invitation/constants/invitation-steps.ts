export interface InvitationStep {
  count: number;
  reward: string;
  amount: number;
}

export const POINTS_PER_INVITATION = 300;

// 2025-09-11 15:25:00 KST
export const INVITATION_STEP_START_DATE = '2025-09-11T06:25:00.000Z';

export const INVITATION_STEPS: InvitationStep[] = [
  { count: 3, reward: '천원 받기', amount: 1000 },
  { count: 5, reward: '2천원 받기', amount: 2000 },
  { count: 7, reward: '3천원 받기', amount: 3000 },
  { count: 10, reward: '5천원 받기', amount: 5000 },
];

// 파트너 프로그램 기간 동안 초대 1건당 지급
export const PARTNER_POINTS_PER_INVITATION = 500;

// 파트너 프로그램 전용 스텝
export const PARTNER_INVITATION_STEPS: InvitationStep[] = [
  { count: 3, reward: '300P 받기', amount: 300 },
  { count: 5, reward: '400P 받기', amount: 400 },
  { count: 7, reward: '600P 받기', amount: 600 },
  { count: 10, reward: '2,000P 받기', amount: 2000 },
  { count: 13, reward: '500P 받기', amount: 500 },
  { count: 15, reward: '700P 받기', amount: 700 },
  { count: 17, reward: '1,000P 받기', amount: 1000 },
  { count: 20, reward: '4,000P 받기', amount: 4000 },
  { count: 23, reward: '800P 받기', amount: 800 },
  { count: 25, reward: '1,200P 받기', amount: 1200 },
  { count: 27, reward: '1,600P 받기', amount: 1600 },
  { count: 30, reward: '6,000P 받기', amount: 6000 },
];
