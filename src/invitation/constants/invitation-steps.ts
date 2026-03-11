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
