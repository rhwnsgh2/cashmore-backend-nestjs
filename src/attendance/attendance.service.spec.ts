import { Test, TestingModule } from '@nestjs/testing';
import { AttendanceService } from './attendance.service';
import { ATTENDANCE_REPOSITORY } from './interfaces/attendance-repository.interface';
import { StubAttendanceRepository } from './repositories/stub-attendance.repository';
import { POINT_WRITE_SERVICE } from '../point-write/point-write.interface';
import { PointWriteService } from '../point-write/point-write.service';
import { StubPointWriteRepository } from '../point-write/repositories/stub-point-write.repository';

describe('AttendanceService', () => {
  let service: AttendanceService;
  let repository: StubAttendanceRepository;
  let pointWriteRepository: StubPointWriteRepository;

  const userId = 'test-user-id';

  beforeEach(async () => {
    repository = new StubAttendanceRepository();
    pointWriteRepository = new StubPointWriteRepository();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AttendanceService,
        { provide: ATTENDANCE_REPOSITORY, useValue: repository },
        {
          provide: POINT_WRITE_SERVICE,
          useFactory: () => {
            return new PointWriteService(pointWriteRepository);
          },
        },
      ],
    }).compile();

    service = module.get<AttendanceService>(AttendanceService);
  });

  afterEach(() => {
    repository.clear();
    pointWriteRepository.clear();
  });

  describe('getAttendances', () => {
    it('출석 기록이 없으면 빈 배열을 반환한다', async () => {
      const result = await service.getAttendances(userId);

      expect(result).toEqual([]);
    });

    it('출석 기록을 반환한다', async () => {
      repository.setAttendances(userId, [
        {
          id: 1,
          userId,
          createdAtDate: '2026-01-15',
          createdAt: '2026-01-15T09:00:00+09:00',
        },
        {
          id: 2,
          userId,
          createdAtDate: '2026-01-16',
          createdAt: '2026-01-16T09:30:00+09:00',
        },
      ]);

      const result = await service.getAttendances(userId);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe(1);
      expect(result[0].attendanceDate).toBe('2026-01-15');
      expect(result[1].id).toBe(2);
      expect(result[1].attendanceDate).toBe('2026-01-16');
    });

    it('다른 사용자의 출석 기록은 포함하지 않는다', async () => {
      const otherUserId = 'other-user-id';

      repository.setAttendances(userId, [
        {
          id: 1,
          userId,
          createdAtDate: '2026-01-15',
          createdAt: '2026-01-15T09:00:00+09:00',
        },
      ]);

      repository.setAttendances(otherUserId, [
        {
          id: 2,
          userId: otherUserId,
          createdAtDate: '2026-01-15',
          createdAt: '2026-01-15T10:00:00+09:00',
        },
      ]);

      const result = await service.getAttendances(userId);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });
  });

  describe('checkIn', () => {
    it('출석 체크에 성공한다', async () => {
      const result = await service.checkIn(userId);

      expect(result.success).toBe(true);
      expect(result.weeklyBonusEarned).toBe(false);
      expect(result.point).toBe(2);
      expect(result.reason).toBeUndefined();
    });

    it('출석 체크 시 PointWriteService를 통해 ATTENDANCE 타입으로 2P가 기록된다', async () => {
      await service.checkIn(userId);

      const actions = pointWriteRepository.getInsertedActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('ATTENDANCE');
      expect(actions[0].amount).toBe(2);
      expect(actions[0].userId).toBe(userId);
      expect(actions[0].status).toBe('done');
    });

    it('출석 체크 시 attendance_id가 additionalData에 포함된다', async () => {
      await service.checkIn(userId);

      const actions = pointWriteRepository.getInsertedActions();
      expect(actions[0].additionalData).toHaveProperty('attendance_id');
      expect(typeof actions[0].additionalData.attendance_id).toBe('number');
    });

    it('이미 출석한 경우 실패를 반환하고 포인트는 0이다', async () => {
      await service.checkIn(userId);

      const result = await service.checkIn(userId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Already attended today');
      expect(result.weeklyBonusEarned).toBe(false);
      expect(result.point).toBe(0);
    });

    it('이미 출석한 경우 추가 포인트가 기록되지 않는다', async () => {
      await service.checkIn(userId);
      pointWriteRepository.clear(); // 첫 번째 체크인 기록 초기화

      await service.checkIn(userId); // 중복 체크인

      const actions = pointWriteRepository.getInsertedActions();
      expect(actions).toHaveLength(0);
    });

    it('주간 개근 시 보너스 포인트 5P가 지급된다', async () => {
      const todayDate = getTodayKST();
      const dayOfWeek = todayDate.getDay();

      const startOfWeek = new Date(todayDate);
      if (dayOfWeek === 0) {
        startOfWeek.setDate(todayDate.getDate() - 6);
      } else {
        startOfWeek.setDate(todayDate.getDate() - dayOfWeek + 1);
      }

      const records: {
        id: number;
        userId: string;
        createdAtDate: string;
        createdAt: string;
      }[] = [];
      const todayStr = formatDate(todayDate);
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = formatDate(date);

        if (dateStr === todayStr) continue;

        records.push({
          id: i + 1,
          userId,
          createdAtDate: dateStr,
          createdAt: `${dateStr}T09:00:00+09:00`,
        });
      }
      repository.setAttendances(userId, records);

      const result = await service.checkIn(userId);

      expect(result.success).toBe(true);
      expect(result.weeklyBonusEarned).toBe(true);
      expect(result.point).toBe(7);

      const actions = pointWriteRepository.getInsertedActions();
      expect(actions).toHaveLength(2);

      const attendanceAction = actions.find((a) => a.type === 'ATTENDANCE');
      expect(attendanceAction).toBeDefined();
      expect(attendanceAction!.amount).toBe(2);

      const bonusAction = actions.find(
        (a) => a.type === 'WEEKLY_ATTENDANCE_BONUS',
      );
      expect(bonusAction).toBeDefined();
      expect(bonusAction!.amount).toBe(5);
    });

    it('주간 개근 보너스에 week_start, week_end가 포함된다', async () => {
      const todayDate = getTodayKST();
      const dayOfWeek = todayDate.getDay();

      const startOfWeek = new Date(todayDate);
      if (dayOfWeek === 0) {
        startOfWeek.setDate(todayDate.getDate() - 6);
      } else {
        startOfWeek.setDate(todayDate.getDate() - dayOfWeek + 1);
      }

      const records: {
        id: number;
        userId: string;
        createdAtDate: string;
        createdAt: string;
      }[] = [];
      const todayStr = formatDate(todayDate);
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = formatDate(date);

        if (dateStr === todayStr) continue;

        records.push({
          id: i + 1,
          userId,
          createdAtDate: dateStr,
          createdAt: `${dateStr}T09:00:00+09:00`,
        });
      }
      repository.setAttendances(userId, records);

      await service.checkIn(userId);

      const actions = pointWriteRepository.getInsertedActions();
      const bonusAction = actions.find(
        (a) => a.type === 'WEEKLY_ATTENDANCE_BONUS',
      );
      expect(bonusAction!.additionalData).toHaveProperty('week_start');
      expect(bonusAction!.additionalData).toHaveProperty('week_end');
    });

    it('출석 레코드 생성 후 포인트가 기록된다 (순서 보장)', async () => {
      const callOrder: string[] = [];

      // insertAttendance 호출 시 순서 기록
      const originalInsert = repository.insertAttendance.bind(repository);
      repository.insertAttendance = async (uid: string, date: string) => {
        callOrder.push('insertAttendance');
        return originalInsert(uid, date);
      };

      // addPoint 호출 시 순서 기록
      const originalAddPoint = service['pointWriteService'].addPoint.bind(
        service['pointWriteService'],
      );
      service['pointWriteService'].addPoint = async (params) => {
        callOrder.push('addPoint');
        return originalAddPoint(params);
      };

      await service.checkIn(userId);

      expect(callOrder).toEqual(['insertAttendance', 'addPoint']);
    });

    it('insertAttendance 예외 발생 시 포인트가 기록되지 않는다', async () => {
      // insertAttendance가 throw하도록 설정 (동시성 충돌 시나리오)
      repository.insertAttendance = async () => {
        throw new Error('unique constraint violation');
      };

      const result = await service.checkIn(userId);

      expect(result.success).toBe(false);
      expect(result.reason).toBe('Already attended today');

      const actions = pointWriteRepository.getInsertedActions();
      expect(actions).toHaveLength(0);
    });

    it('addPoint 에러 시 예외가 전파된다 (silent fail 방지)', async () => {
      service['pointWriteService'].addPoint = async () => {
        throw new Error('DB connection failed');
      };

      await expect(service.checkIn(userId)).rejects.toThrow(
        'DB connection failed',
      );
    });

    it('ATTENDANCE 포인트의 additionalData에는 attendance_id만 포함된다', async () => {
      await service.checkIn(userId);

      const actions = pointWriteRepository.getInsertedActions();
      const attendanceAction = actions.find((a) => a.type === 'ATTENDANCE');
      expect(Object.keys(attendanceAction!.additionalData)).toEqual([
        'attendance_id',
      ]);
    });

    it('주간 개근 보너스의 status도 done이다', async () => {
      const todayDate = getTodayKST();
      const dayOfWeek = todayDate.getDay();

      const startOfWeek = new Date(todayDate);
      if (dayOfWeek === 0) {
        startOfWeek.setDate(todayDate.getDate() - 6);
      } else {
        startOfWeek.setDate(todayDate.getDate() - dayOfWeek + 1);
      }

      const records: {
        id: number;
        userId: string;
        createdAtDate: string;
        createdAt: string;
      }[] = [];
      const todayStr = formatDate(todayDate);
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = formatDate(date);

        if (dateStr === todayStr) continue;

        records.push({
          id: i + 1,
          userId,
          createdAtDate: dateStr,
          createdAt: `${dateStr}T09:00:00+09:00`,
        });
      }
      repository.setAttendances(userId, records);

      await service.checkIn(userId);

      const actions = pointWriteRepository.getInsertedActions();
      const bonusAction = actions.find(
        (a) => a.type === 'WEEKLY_ATTENDANCE_BONUS',
      );
      expect(bonusAction!.status).toBe('done');
      expect(bonusAction!.userId).toBe(userId);
    });

    it('주간 개근 보너스의 week_start는 월요일, week_end�� 일요일이다', async () => {
      const todayDate = getTodayKST();
      const dayOfWeek = todayDate.getDay();

      const startOfWeek = new Date(todayDate);
      if (dayOfWeek === 0) {
        startOfWeek.setDate(todayDate.getDate() - 6);
      } else {
        startOfWeek.setDate(todayDate.getDate() - dayOfWeek + 1);
      }

      const endOfWeek = new Date(startOfWeek);
      endOfWeek.setDate(startOfWeek.getDate() + 6);

      const records: {
        id: number;
        userId: string;
        createdAtDate: string;
        createdAt: string;
      }[] = [];
      const todayStr = formatDate(todayDate);
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = formatDate(date);

        if (dateStr === todayStr) continue;

        records.push({
          id: i + 1,
          userId,
          createdAtDate: dateStr,
          createdAt: `${dateStr}T09:00:00+09:00`,
        });
      }
      repository.setAttendances(userId, records);

      await service.checkIn(userId);

      const actions = pointWriteRepository.getInsertedActions();
      const bonusAction = actions.find(
        (a) => a.type === 'WEEKLY_ATTENDANCE_BONUS',
      );
      expect(bonusAction!.additionalData.week_start).toBe(
        formatDate(startOfWeek),
      );
      expect(bonusAction!.additionalData.week_end).toBe(formatDate(endOfWeek));
    });

    it('주간 출석이 6일인 경우 보너스가 지급되지 않는다', async () => {
      const todayDate = getTodayKST();
      const dayOfWeek = todayDate.getDay();

      const startOfWeek = new Date(todayDate);
      if (dayOfWeek === 0) {
        startOfWeek.setDate(todayDate.getDate() - 6);
      } else {
        startOfWeek.setDate(todayDate.getDate() - dayOfWeek + 1);
      }

      // 오늘 포함 6일만 (하루 빠짐)
      const records: {
        id: number;
        userId: string;
        createdAtDate: string;
        createdAt: string;
      }[] = [];
      const todayStr = formatDate(todayDate);
      let skipped = false;
      for (let i = 0; i < 7; i++) {
        const date = new Date(startOfWeek);
        date.setDate(startOfWeek.getDate() + i);
        const dateStr = formatDate(date);

        if (dateStr === todayStr) continue;

        // 하루 건너뛰기
        if (!skipped && dateStr !== todayStr) {
          skipped = true;
          continue;
        }

        records.push({
          id: i + 1,
          userId,
          createdAtDate: dateStr,
          createdAt: `${dateStr}T09:00:00+09:00`,
        });
      }
      repository.setAttendances(userId, records);

      const result = await service.checkIn(userId);

      expect(result.success).toBe(true);
      expect(result.weeklyBonusEarned).toBe(false);
      expect(result.point).toBe(2);

      const actions = pointWriteRepository.getInsertedActions();
      expect(actions).toHaveLength(1);
      expect(actions[0].type).toBe('ATTENDANCE');
    });
  });
});

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayKST(): Date {
  const now = new Date();
  const kstOffset = 9 * 60 * 60 * 1000;
  const kst = new Date(now.getTime() + kstOffset);
  return new Date(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate());
}
