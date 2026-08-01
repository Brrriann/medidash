-- AI 생성 이력 + 결과물 미리보기 저장
--
-- **왜 works로 안 되는가**
-- works는 "저장 버튼을 누른 산출물"만 담는다. 그런데 유료 API 호출은 저장 여부와 무관하게
-- 일어나고 할당량을 깎는다(consume_ai_quota). 실패한 호출도 마찬가지다 — 유료 호출 직전에
-- 차감하기 때문이다. 그래서 "왜 오늘 3회밖에 안 남았지?"에 답하려면 **호출 자체의 기록**이
-- 따로 있어야 한다. 성공만 남기면 줄어든 할당량의 절반이 설명되지 않는다.
--
-- **미리보기만 저장하는 이유**
-- 후킹페이지 2장 원본은 PNG로 세트당 약 3MB다. 수강생 50명이 하루 2세트만 만들어도
-- 월 9GB로 Supabase 무료 1GB를 하루 만에, Pro 100GB도 11개월에 채운다.
-- 512px WebP 미리보기는 세트당 약 80KB(약 97% 감소)라 용량이 사실상 문제가 되지 않는다.
-- 이력의 목적은 "무엇을 만들었나" 확인이고, 원본은 만들 때 바로 내려받는 흐름이다.
-- 재다운로드가 실제로 필요해지면 그때 원본 저장을 켜면 된다.

-- ── AI 호출 이력 ────────────────────────────────────────────
create table if not exists medidash.ai_logs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  -- 어떤 호출인지. 종류가 늘 수 있어 check로 묶지 않는다(마이그레이션 없이 추가되게).
  kind text not null,
  ok boolean not null,
  -- 실패 사유. 사용자에게 그대로 보여줄 문구라 원문 대신 요약을 넣는다.
  error text,
  -- 원료·상품 id·프리셋 등 재현에 필요한 최소 정보
  meta jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- 마이페이지는 "내 것 최근 순"만 조회한다.
create index if not exists ai_logs_user_created_idx
  on medidash.ai_logs (user_id, created_at desc);

alter table medidash.ai_logs enable row level security;

-- 본인 것만 읽기. 쓰기 정책은 두지 않는다 — 기록은 서버(service role)만 남긴다.
-- service role은 RLS를 우회하므로 별도 정책이 필요 없고, 클라이언트가 이력을 위조할 수 없다.
drop policy if exists "read own ai_logs" on medidash.ai_logs;
create policy "read own ai_logs" on medidash.ai_logs
  for select to authenticated
  using (user_id = auth.uid() or medidash.is_admin());

-- ── 결과물 미리보기 경로 ─────────────────────────────────────
alter table medidash.works
  add column if not exists preview_path text;

comment on column medidash.works.preview_path is
  'previews 버킷 내 경로 (512px WebP). 원본은 저장하지 않는다 — 0006 마이그레이션 주석 참고';

-- works.kind에 후킹페이지를 추가한다. check 제약은 이름을 모르므로 찾아서 교체한다.
do $$
declare c text;
begin
  select conname into c from pg_constraint
   where conrelid = 'medidash.works'::regclass and contype = 'c'
     and pg_get_constraintdef(oid) ilike '%thumbnail%';
  if c is not null then
    execute format('alter table medidash.works drop constraint %I', c);
  end if;
end $$;

alter table medidash.works
  add constraint works_kind_check
  check (kind in ('thumbnail','title_tags','margin','hook_page'));

-- ── 미리보기 버킷 ───────────────────────────────────────────
-- 비공개 버킷. 조회는 서명 URL로만 내보낸다(경로를 알아도 남의 것을 못 본다).
insert into storage.buckets (id, name, public)
values ('previews', 'previews', false)
on conflict (id) do nothing;

-- 경로 규칙: previews/<user_id>/<works_id>-<n>.webp
-- 첫 폴더가 본인 uid일 때만 접근 — 남의 폴더는 목록 조회도 안 된다.
drop policy if exists "own previews read" on storage.objects;
create policy "own previews read" on storage.objects
  for select to authenticated
  using (bucket_id = 'previews' and (storage.foldername(name))[1] = auth.uid()::text);

drop policy if exists "own previews delete" on storage.objects;
create policy "own previews delete" on storage.objects
  for delete to authenticated
  using (bucket_id = 'previews' and (storage.foldername(name))[1] = auth.uid()::text);

-- 업로드는 서버(service role)만 한다. 클라이언트가 임의 파일을 밀어 넣지 못하게
-- insert 정책을 두지 않는다.
