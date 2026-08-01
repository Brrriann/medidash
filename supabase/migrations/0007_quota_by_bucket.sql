-- AI 한도를 이미지·텍스트로 분리
--
-- **왜 나누는가**
-- 종전엔 이미지와 텍스트가 한 통에 하루 5회였다. 그런데 실제 비용이 100배 차이난다:
--   gpt-image-1  1회 ≈ 20~200원
--   gpt-4o-mini  1턴 ≈ 0.3원
-- CS 답변 챗봇이 붙으면 3턴만 주고받아도 그날 썸네일을 못 만든다. 반대로 챗봇 때문에
-- 통합 한도를 20으로 올리면 이미지 비용이 4배가 된다. 비용이 다른 것을 같은 통에
-- 넣은 게 문제라 통을 나눈다.
--
-- 기존 행은 전부 이미지로 본다 — 종전 한도가 사실상 이미지 생성 방어용이었다.

alter table medidash.ai_usage
  add column if not exists bucket text not null default 'image';

-- 기본키를 (user_id, used_on) → (user_id, used_on, bucket)으로 넓힌다.
-- 기존 행은 모두 bucket='image'라 중복이 생기지 않는다.
do $$
begin
  if exists (
    select 1 from pg_constraint
     where conrelid = 'medidash.ai_usage'::regclass and contype = 'p'
       and array_length(conkey, 1) = 2
  ) then
    alter table medidash.ai_usage drop constraint ai_usage_pkey;
    alter table medidash.ai_usage add primary key (user_id, used_on, bucket);
  end if;
end $$;

-- 인자가 달라지면 overload가 생겨 어느 쪽이 불릴지 모호해진다. 옛 시그니처를 지운다.
drop function if exists medidash.consume_ai_quota(uuid, int);
drop function if exists medidash.ai_quota_used(uuid);

/**
 * 해당 통(bucket)의 한도 안이면 1회 차감하고 true, 넘었으면 false.
 *
 * 조건 검사와 증가가 한 문장 안에서 일어나야 한다 — 읽고 나서 애플리케이션에서 +1 하면
 * 동시 요청이 한도를 넘긴다(0004 가입코드에서 같은 버그를 겪었다).
 */
create or replace function medidash.consume_ai_quota(
  p_user uuid, p_bucket text, p_limit int
)
returns boolean
language plpgsql
security definer
set search_path = medidash, pg_temp
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  affected int;
begin
  insert into medidash.ai_usage (user_id, used_on, bucket, count)
  values (p_user, today, p_bucket, 1)
  on conflict (user_id, used_on, bucket)
    do update set count = medidash.ai_usage.count + 1
    where medidash.ai_usage.count < p_limit;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

/** 오늘 해당 통의 사용 횟수 (남은 횟수 표시용) */
create or replace function medidash.ai_quota_used(p_user uuid, p_bucket text)
returns int
language sql
security definer
set search_path = medidash, pg_temp
as $$
  select coalesce(
    (select count from medidash.ai_usage
      where user_id = p_user
        and used_on = (now() at time zone 'Asia/Seoul')::date
        and bucket = p_bucket),
    0);
$$;

-- ⚠️ revoke만 하면 service_role까지 막힌다(EXECUTE 기본이 PUBLIC) — 0004에서 겪었다.
revoke all on function medidash.consume_ai_quota(uuid, text, int) from public, anon, authenticated;
revoke all on function medidash.ai_quota_used(uuid, text) from public, anon, authenticated;
grant execute on function medidash.consume_ai_quota(uuid, text, int) to service_role;
grant execute on function medidash.ai_quota_used(uuid, text) to service_role;

-- ── 운영 프로필 ─────────────────────────────────────────────
-- CS 답변은 **셀러의 운영 정책을 알아야 쓸모가 있다.** "배송 언제 오나요"에 일반론으로
-- 답하면 그대로 클레임이 된다. 항목이 늘 수 있어 컬럼 대신 jsonb 한 칸으로 둔다.
alter table medidash.profiles
  add column if not exists ops_profile jsonb not null default '{}'::jsonb;

comment on column medidash.profiles.ops_profile is
  '운영 프로필 {brandName, category, channels[{platform,storeName,url}], shipping, returns, notes} — CS 답변 생성 입력';
