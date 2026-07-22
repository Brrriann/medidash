-- ============================================================
-- MediDash 초기 스키마
-- 분류 체계: 대·중·소 3단 (docs/UI-PLAN.md §3·§10)
-- 지원 테이블: docs/SPEC.md §4
-- ============================================================

-- ── 3단 분류 ─────────────────────────────────────────────────

-- 대분류: 인체 계통 10개 (지도 클릭 진입점)
create table body_categories (
  id serial primary key,
  slug text unique not null,          -- nervous, sensory, circulatory ...
  name text not null,                 -- 신경계/뇌 등
  svg_region text not null,           -- 인체 SVG 영역 id ('chip' = 실루엣 옆 라벨 칩)
  sort int default 0
);

-- 중분류: 부위/기능 (셀러 판매 각도 결정)
create table body_subcategories (
  id serial primary key,
  category_id int not null references body_categories(id) on delete cascade,
  slug text unique not null,          -- memory, eye, liver ...
  name text not null,                 -- 기억력·인지 등
  sort int default 0
);

-- 소분류: 증상 키워드 (원료·셀링포인트 매핑 트리거)
create table symptom_keywords (
  id serial primary key,
  subcategory_id int not null references body_subcategories(id) on delete cascade,
  keyword text not null,              -- 과민성장, 잔변감 ...
  ai_prompt_template text,            -- 소분류 단위 AI 프롬프트 (선택)
  sort int default 0,
  unique (subcategory_id, keyword)
);

-- 4-Tab 상세 패널 콘텐츠 (고객 제공 데이터 적재 + AI 초안 캐시)
create table subcategory_contents (
  id serial primary key,
  subcategory_id int unique not null references body_subcategories(id) on delete cascade,
  feature text,                       -- ① 특징: 부위 개요·관련 증상 요약
  mechanism text,                     -- ③ 기전원리
  selling_points text[] default '{}', -- ④ 셀링포인트 (법적 안전 표현)
  source text not null default 'seed' check (source in ('seed','ai_draft')),
  updated_at timestamptz not null default now()
);

-- ── 원료 ─────────────────────────────────────────────────────

create table ingredients (
  id serial primary key,
  name text unique not null,          -- 쏘팔메토, 콘드로이친 ...
  aliases text[] default '{}',        -- 검색 별칭 (크롤러 원료 매칭 사전)
  certification_type text check (certification_type in ('고시형','개별인정형')),
  daily_intake text,                  -- 일일 섭취량 표기
  note text
);

-- 증상(소분류) ↔ 원료 매핑 (docs/UI-PLAN.md §10 ingredient_mapping)
create table symptom_ingredients (
  symptom_id int not null references symptom_keywords(id) on delete cascade,
  ingredient_id int not null references ingredients(id) on delete cascade,
  rank int default 0,
  primary key (symptom_id, ingredient_id)
);

-- ── 도매몰/방송 캐시 (월 1회 크롤러 upsert) ──────────────────

create table wholesale_products (
  id bigserial primary key,
  source text not null check (source in ('gonyb2b','ggsan','upickb2b')),
  source_url text unique not null,
  name text not null,
  price_wholesale int,                -- 도매가(원)
  image_url text,
  detail jsonb,                       -- 원료/함량 등 파싱 결과
  ingredient_ids int[],               -- 매칭된 원료
  crawled_at timestamptz
);

create table broadcast_stats (
  id bigserial primary key,
  keyword text not null,              -- 원료명 or 브랜드명
  kind text check (kind in ('ingredient','brand')),
  broadcast_count int,                -- 방송 노출 횟수
  recent_titles jsonb,                -- 최근 방송 상품명 목록
  crawled_at timestamptz,
  unique (keyword, kind)
);

-- ── 사용자 ───────────────────────────────────────────────────

-- 가입 코드 (수강생 코드 — 없으면 가입 불가)
create table invite_codes (
  code text primary key,
  memo text,
  max_uses int default 1,
  used int default 0,
  expires_at timestamptz
);

-- 역할/프로필 (admin: 운영자 / member: 수강생)
create table profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('admin','member')),
  invite_code text references invite_codes(code),
  created_at timestamptz not null default now()
);

-- 사용자 작업물 (썸네일/상품명·태그/마진)
create table works (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text check (kind in ('thumbnail','title_tags','margin')),
  input jsonb,
  output jsonb,
  created_at timestamptz not null default now()
);

-- 마진 계산 히스토리
create table margin_calcs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_ref bigint references wholesale_products(id),
  inputs jsonb not null,              -- 원가/판매가/수수료율/배송비 ...
  results jsonb not null,             -- 마진율/마진액/손익분기
  created_at timestamptz not null default now()
);

-- 결제 (PG 단건 결제·취소·내역 — 크레딧 차감 로직 없음: 범위 가드)
create table payments (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pg text,
  order_id text unique,
  amount int,
  status text,                        -- ready/paid/canceled/failed
  raw jsonb,
  created_at timestamptz not null default now()
);

-- ── 트리거 ───────────────────────────────────────────────────

create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_subcategory_contents_updated
  before update on subcategory_contents
  for each row execute function set_updated_at();

-- ── RLS ──────────────────────────────────────────────────────

-- admin 판별 (profiles 순환 참조 없이 사용하기 위한 security definer)
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public
as $$
  select exists (
    select 1 from profiles where id = auth.uid() and role = 'admin'
  )
$$;

alter table body_categories enable row level security;
alter table body_subcategories enable row level security;
alter table symptom_keywords enable row level security;
alter table subcategory_contents enable row level security;
alter table ingredients enable row level security;
alter table symptom_ingredients enable row level security;
alter table wholesale_products enable row level security;
alter table broadcast_stats enable row level security;
alter table invite_codes enable row level security;
alter table profiles enable row level security;
alter table works enable row level security;
alter table margin_calcs enable row level security;
alter table payments enable row level security;

-- 분류·원료·캐시: 로그인 사용자 읽기, 쓰기는 admin만 (시드/크롤러는 service role)
create policy "read taxonomy" on body_categories for select to authenticated using (true);
create policy "admin write taxonomy" on body_categories for all to authenticated using (is_admin()) with check (is_admin());
create policy "read subcategories" on body_subcategories for select to authenticated using (true);
create policy "admin write subcategories" on body_subcategories for all to authenticated using (is_admin()) with check (is_admin());
create policy "read symptoms" on symptom_keywords for select to authenticated using (true);
create policy "admin write symptoms" on symptom_keywords for all to authenticated using (is_admin()) with check (is_admin());
create policy "read contents" on subcategory_contents for select to authenticated using (true);
create policy "admin write contents" on subcategory_contents for all to authenticated using (is_admin()) with check (is_admin());
create policy "read ingredients" on ingredients for select to authenticated using (true);
create policy "admin write ingredients" on ingredients for all to authenticated using (is_admin()) with check (is_admin());
create policy "read symptom_ingredients" on symptom_ingredients for select to authenticated using (true);
create policy "admin write symptom_ingredients" on symptom_ingredients for all to authenticated using (is_admin()) with check (is_admin());
create policy "read wholesale" on wholesale_products for select to authenticated using (true);
create policy "admin write wholesale" on wholesale_products for all to authenticated using (is_admin()) with check (is_admin());
create policy "read broadcast" on broadcast_stats for select to authenticated using (true);
create policy "admin write broadcast" on broadcast_stats for all to authenticated using (is_admin()) with check (is_admin());

-- 가입 코드: admin 전용 (가입 시 검증은 service role이 수행 — RLS 우회)
create policy "admin manage invite_codes" on invite_codes for all to authenticated using (is_admin()) with check (is_admin());

-- 프로필: 본인 조회, admin 전체 조회 (생성/역할 변경은 service role)
create policy "read own profile" on profiles for select to authenticated using (id = auth.uid() or is_admin());

-- 작업물/마진: member는 자기 것만 CRUD, admin 열람
create policy "own works" on works for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin read works" on works for select to authenticated using (is_admin());
create policy "own margin_calcs" on margin_calcs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin read margin_calcs" on margin_calcs for select to authenticated using (is_admin());

-- 결제: 본인·admin 조회만 (기록/갱신은 서버 콜백이 service role로)
create policy "read own payments" on payments for select to authenticated
  using (user_id = auth.uid() or is_admin());

-- ── 인덱스 ───────────────────────────────────────────────────

create index idx_subcategories_category on body_subcategories(category_id);
create index idx_symptoms_subcategory on symptom_keywords(subcategory_id);
create index idx_symptom_ingredients_ingredient on symptom_ingredients(ingredient_id);
create index idx_wholesale_source on wholesale_products(source);
create index idx_wholesale_name on wholesale_products using gin (to_tsvector('simple', name));
create index idx_works_user on works(user_id, created_at desc);
create index idx_margin_user on margin_calcs(user_id, created_at desc);
