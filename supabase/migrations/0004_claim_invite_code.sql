-- 수강생 코드 사용 처리를 원자적으로 (동시 가입 시 정원 초과 방지)
--
-- 종전 코드는 `used`를 읽고 애플리케이션에서 +1 해서 덮어썼다(lost update).
-- 개강일에 두 명이 동시에 가입하면 둘 다 used=5를 읽고 둘 다 6을 쓴다 — 실제로는 7이어야 한다.
-- 정원 10명짜리 코드로 11명이 가입될 수 있다.
--
-- update ... where used < max_uses 는 행 잠금 안에서 조건과 증가가 함께 일어나므로
-- 경쟁이 생기지 않는다. 갱신된 행 수로 성공 여부를 판단한다.

create or replace function medidash.claim_invite_code(p_code text)
returns boolean
language plpgsql
security definer
-- search_path 고정: security definer 함수가 호출자의 search_path에 끌려가지 않게 한다
set search_path = medidash, pg_temp
as $$
declare
  claimed int;
begin
  update medidash.invite_codes
     set used = used + 1
   where code = p_code
     and used < max_uses
     and (expires_at is null or expires_at > now());
  get diagnostics claimed = row_count;
  return claimed > 0;
end;
$$;

-- 회원 생성이 실패하면 차감을 되돌린다 (코드를 먼저 잡고 계정을 만들기 때문).
-- 0 밑으로는 안 내려가게 막는다.
create or replace function medidash.release_invite_code(p_code text)
returns void
language sql
security definer
set search_path = medidash, pg_temp
as $$
  update medidash.invite_codes
     set used = greatest(used - 1, 0)
   where code = p_code;
$$;

-- 가입 처리는 service role로만 부른다. 일반 사용자가 직접 호출해 정원을 소진시키지 못하게 막는다.
--
-- ⚠️ revoke만 하면 안 된다. 함수 EXECUTE 권한은 기본으로 PUBLIC에 딸려 있어서,
-- PUBLIC에서 회수하면 service_role도 같이 막힌다(실측: permission denied for function).
-- 회수한 뒤 service_role에 명시적으로 다시 부여해야 한다.
revoke all on function medidash.claim_invite_code(text) from public, anon, authenticated;
revoke all on function medidash.release_invite_code(text) from public, anon, authenticated;
grant execute on function medidash.claim_invite_code(text) to service_role;
grant execute on function medidash.release_invite_code(text) to service_role;
