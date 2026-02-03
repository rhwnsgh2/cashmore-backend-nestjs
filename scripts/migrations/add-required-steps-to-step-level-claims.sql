-- Migration: Add required_steps column to step_level_claims table
-- Purpose: Enable version-independent duplicate checking based on step thresholds
--
-- ⚠️ 실행 전 반드시 중복 체크 먼저 실행:
-- SELECT user_id, claim_date, level, COUNT(*)
-- FROM step_level_claims
-- GROUP BY user_id, claim_date, level
-- HAVING COUNT(*) > 1;

------------------------------------------------------------
-- STEP 1: 컬럼 추가 (빠름, 안전)
------------------------------------------------------------
ALTER TABLE step_level_claims
ADD COLUMN IF NOT EXISTS required_steps INTEGER;

------------------------------------------------------------
-- STEP 2: 백필 (배치로 나눠서 실행 - 각각 별도로 실행)
-- v1 config: level 1=0, 2=2000, 3=4000, 4=6000, 5=8000, 6=10000
------------------------------------------------------------

-- 2-1: level 1 백필
UPDATE step_level_claims
SET required_steps = 0
WHERE level = 1 AND required_steps IS NULL;

-- 2-2: level 2 백필
UPDATE step_level_claims
SET required_steps = 2000
WHERE level = 2 AND required_steps IS NULL;

-- 2-3: level 3 백필
UPDATE step_level_claims
SET required_steps = 4000
WHERE level = 3 AND required_steps IS NULL;

-- 2-4: level 4 백필
UPDATE step_level_claims
SET required_steps = 6000
WHERE level = 4 AND required_steps IS NULL;

-- 2-5: level 5 백필
UPDATE step_level_claims
SET required_steps = 8000
WHERE level = 5 AND required_steps IS NULL;

-- 2-6: level 6 백필
UPDATE step_level_claims
SET required_steps = 10000
WHERE level = 6 AND required_steps IS NULL;

-- 2-7: 기타 level (있다면)
UPDATE step_level_claims
SET required_steps = level * 1000
WHERE level NOT IN (1,2,3,4,5,6) AND required_steps IS NULL;

------------------------------------------------------------
-- STEP 3: NOT NULL 제약 추가
------------------------------------------------------------
ALTER TABLE step_level_claims
ALTER COLUMN required_steps SET NOT NULL;

------------------------------------------------------------
-- STEP 4: 인덱스 생성 (CONCURRENTLY로 락 방지)
-- ⚠️ 트랜잭션 밖에서 별도 실행 필요
------------------------------------------------------------
-- CREATE INDEX CONCURRENTLY idx_step_level_claims_user_date_required_steps
-- ON step_level_claims (user_id, claim_date, required_steps);

------------------------------------------------------------
-- STEP 5: UNIQUE 제약 (선택사항 - 애플리케이션에서 체크하면 생략 가능)
-- ⚠️ 대용량 테이블에서는 주의
------------------------------------------------------------
-- ALTER TABLE step_level_claims
-- ADD CONSTRAINT uq_step_level_claims_user_date_required_steps
-- UNIQUE (user_id, claim_date, required_steps);
