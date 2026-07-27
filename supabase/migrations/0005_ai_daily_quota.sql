-- AI 생성 일일 한도 (docs/PRODUCTION-READINESS.md P0-5)
--
-- 썸네일 배경·인물, 상품명 제안은 전부 유료 API 호출이다. 수강생 300명이 무제한으로
-- 돌리면 비용이 그대로 청구된다. 크레딧 차감형 과금은 2차 계약 범위(docs/SPEC.md §2)라
-- 여기서는 **일일 횟수 제한**이라는 최소 방어선만 둔다.
--
-- 날짜는 Asia/Seoul 기준. UTC로 두면 한국 사용자에게 오전 9시에 한도가 초기화돼 이상하다.

create table if not exists medidash.ai_usage (
  user_id uuid not null references auth.users (id) on delete cascade,
  used_on date not null,
  count int not null default 0,
  primary key (user_id, used_on)
);

alter table medidash.ai_usage enable row level security;

-- 본인 사용량만 조회 (남은 횟수 표시용). 쓰기는 아래 함수(service role)로만.
-- drop 먼저: create policy는 if not exists를 지원하지 않아, 이게 없으면 재실행이
-- "42710 policy already exists"로 죽는다. 이 파일은 운영 중인 DB에 뒤늦게 적용하는
-- 경우가 있어(0001만 실행된 배포) 재실행 안전성이 필요하다.
drop policy if exists "read own ai usage" on medidash.ai_usage;
create policy "read own ai usage" on medidash.ai_usage
  for select to authenticated using (user_id = auth.uid());

/**
 * 한도 안이면 1회 차감하고 true, 넘었으면 아무것도 안 하고 false.
 *
 * 조건 검사와 증가가 한 문장 안에서 일어나야 한다. 읽고 나서 애플리케이션에서 +1 하면
 * 동시 요청이 한도를 넘길 수 있다(가입코드에서 같은 버그가 있었다 — 0004 참고).
 * ON CONFLICT ... WHERE 로 "한도 미만일 때만 증가"를 원자적으로 처리한다.
 */
create or replace function medidash.consume_ai_quota(p_user uuid, p_limit int)
returns boolean
language plpgsql
security definer
set search_path = medidash, pg_temp
as $$
declare
  today date := (now() at time zone 'Asia/Seoul')::date;
  affected int;
begin
  insert into medidash.ai_usage (user_id, used_on, count)
  values (p_user, today, 1)
  on conflict (user_id, used_on)
    do update set count = medidash.ai_usage.count + 1
    where medidash.ai_usage.count < p_limit;
  get diagnostics affected = row_count;
  return affected > 0;
end;
$$;

/** 오늘 사용 횟수 (화면에 남은 횟수를 보여주기 위해). */
create or replace function medidash.ai_quota_used(p_user uuid)
returns int
language sql
security definer
set search_path = medidash, pg_temp
as $$
  select coalesce(
    (select count from medidash.ai_usage
      where user_id = p_user
        and used_on = (now() at time zone 'Asia/Seoul')::date),
    0);
$$;

-- 차감은 서버(service role)만. 사용자가 직접 불러 남의 한도를 소진시키지 못하게 막는다.
-- ⚠️ revoke만 하면 service_role까지 막힌다(함수 EXECUTE는 기본이 PUBLIC) — 0004에서 겪었다.
revoke all on function medidash.consume_ai_quota(uuid, int) from public, anon, authenticated;
revoke all on function medidash.ai_quota_used(uuid) from public, anon, authenticated;
grant execute on function medidash.consume_ai_quota(uuid, int) to service_role;
grant execute on function medidash.ai_quota_used(uuid) to service_role;
