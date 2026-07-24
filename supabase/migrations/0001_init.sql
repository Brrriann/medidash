-- ============================================================
-- MediDash 초기 스키마 — 전용 스키마 'medidash'에 격리 설치
-- (기존 Supabase 프로젝트와 테이블 이름 충돌 방지. auth.users는 프로젝트 공용)
-- 분류: 대·중·소 3단 (docs/UI-PLAN.md §3·§10) / 지원 테이블: docs/SPEC.md §4
--
-- ⚠️ 설치 후 Supabase 대시보드 → Project Settings → API → "Exposed schemas"에
--    medidash 를 추가해야 앱(supabase-js)이 접근할 수 있습니다. (docs/DEPLOY.md)
-- ============================================================

create schema if not exists medidash;
grant usage on schema medidash to anon, authenticated, service_role;

-- ── 3단 분류 ─────────────────────────────────────────────────

create table medidash.body_categories (
  id serial primary key,
  slug text unique not null,
  name text not null,
  svg_region text not null,          -- 인체 SVG 영역 id ('chip' = 라벨 칩)
  sort int default 0
);

create table medidash.body_subcategories (
  id serial primary key,
  category_id int not null references medidash.body_categories(id) on delete cascade,
  slug text unique not null,
  name text not null,
  sort int default 0
);

create table medidash.symptom_keywords (
  id serial primary key,
  subcategory_id int not null references medidash.body_subcategories(id) on delete cascade,
  keyword text not null,
  ai_prompt_template text,
  sort int default 0,
  unique (subcategory_id, keyword)
);

create table medidash.subcategory_contents (
  id serial primary key,
  subcategory_id int unique not null references medidash.body_subcategories(id) on delete cascade,
  feature text,
  mechanism text,
  selling_points text[] default '{}',
  source text not null default 'seed' check (source in ('seed','ai_draft')),
  updated_at timestamptz not null default now()
);

-- ── 원료 ─────────────────────────────────────────────────────

create table medidash.ingredients (
  id serial primary key,
  name text unique not null,
  aliases text[] default '{}',
  certification_type text check (certification_type in ('고시형','개별인정형')),
  daily_intake text,
  note text
);

create table medidash.symptom_ingredients (
  symptom_id int not null references medidash.symptom_keywords(id) on delete cascade,
  ingredient_id int not null references medidash.ingredients(id) on delete cascade,
  rank int default 0,
  primary key (symptom_id, ingredient_id)
);

-- ── 도매몰/방송 캐시 (월 1회 크롤러 upsert) ──────────────────

create table medidash.wholesale_products (
  id bigserial primary key,
  source text not null check (source in ('gonyb2b','ggsan','upickb2b')),
  source_url text unique not null,
  name text not null,
  price_wholesale int,
  image_url text,
  detail jsonb,
  ingredient_ids int[],
  crawled_at timestamptz
);

create table medidash.broadcast_stats (
  id bigserial primary key,
  keyword text not null,
  kind text check (kind in ('ingredient','brand')),
  broadcast_count int,
  recent_titles jsonb,
  crawled_at timestamptz,
  unique (keyword, kind)
);

-- ── 사용자 ───────────────────────────────────────────────────

create table medidash.invite_codes (
  code text primary key,
  memo text,
  max_uses int default 1,
  used int default 0,
  expires_at timestamptz
);

create table medidash.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  role text not null default 'member' check (role in ('admin','member')),
  invite_code text references medidash.invite_codes(code),
  created_at timestamptz not null default now()
);

create table medidash.works (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text check (kind in ('thumbnail','title_tags','margin')),
  input jsonb,
  output jsonb,
  created_at timestamptz not null default now()
);

create table medidash.margin_calcs (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  product_ref bigint references medidash.wholesale_products(id),
  inputs jsonb not null,
  results jsonb not null,
  created_at timestamptz not null default now()
);

create table medidash.payments (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  pg text,
  order_id text unique,
  amount int,
  status text,
  raw jsonb,
  created_at timestamptz not null default now()
);

-- ── 함수·트리거 ──────────────────────────────────────────────

create or replace function medidash.set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create trigger trg_subcategory_contents_updated
  before update on medidash.subcategory_contents
  for each row execute function medidash.set_updated_at();

-- admin 판별 (RLS 순환 참조 없이) — medidash.profiles 참조
create or replace function medidash.is_admin()
returns boolean
language sql stable security definer
set search_path = medidash, public
as $$
  select exists (
    select 1 from medidash.profiles where id = auth.uid() and role = 'admin'
  )
$$;

-- ── RLS ──────────────────────────────────────────────────────

alter table medidash.body_categories enable row level security;
alter table medidash.body_subcategories enable row level security;
alter table medidash.symptom_keywords enable row level security;
alter table medidash.subcategory_contents enable row level security;
alter table medidash.ingredients enable row level security;
alter table medidash.symptom_ingredients enable row level security;
alter table medidash.wholesale_products enable row level security;
alter table medidash.broadcast_stats enable row level security;
alter table medidash.invite_codes enable row level security;
alter table medidash.profiles enable row level security;
alter table medidash.works enable row level security;
alter table medidash.margin_calcs enable row level security;
alter table medidash.payments enable row level security;

-- 분류·원료·캐시: 로그인 사용자 읽기, 쓰기는 admin (시드/크롤러는 service role)
create policy "read taxonomy" on medidash.body_categories for select to authenticated using (true);
create policy "admin write taxonomy" on medidash.body_categories for all to authenticated using (medidash.is_admin()) with check (medidash.is_admin());
create policy "read subcategories" on medidash.body_subcategories for select to authenticated using (true);
create policy "admin write subcategories" on medidash.body_subcategories for all to authenticated using (medidash.is_admin()) with check (medidash.is_admin());
create policy "read symptoms" on medidash.symptom_keywords for select to authenticated using (true);
create policy "admin write symptoms" on medidash.symptom_keywords for all to authenticated using (medidash.is_admin()) with check (medidash.is_admin());
create policy "read contents" on medidash.subcategory_contents for select to authenticated using (true);
create policy "admin write contents" on medidash.subcategory_contents for all to authenticated using (medidash.is_admin()) with check (medidash.is_admin());
create policy "read ingredients" on medidash.ingredients for select to authenticated using (true);
create policy "admin write ingredients" on medidash.ingredients for all to authenticated using (medidash.is_admin()) with check (medidash.is_admin());
create policy "read symptom_ingredients" on medidash.symptom_ingredients for select to authenticated using (true);
create policy "admin write symptom_ingredients" on medidash.symptom_ingredients for all to authenticated using (medidash.is_admin()) with check (medidash.is_admin());
create policy "read wholesale" on medidash.wholesale_products for select to authenticated using (true);
create policy "admin write wholesale" on medidash.wholesale_products for all to authenticated using (medidash.is_admin()) with check (medidash.is_admin());
create policy "read broadcast" on medidash.broadcast_stats for select to authenticated using (true);
create policy "admin write broadcast" on medidash.broadcast_stats for all to authenticated using (medidash.is_admin()) with check (medidash.is_admin());

-- 가입 코드: admin 전용 (가입 검증은 service role)
create policy "admin manage invite_codes" on medidash.invite_codes for all to authenticated using (medidash.is_admin()) with check (medidash.is_admin());

-- 프로필: 본인·admin 조회 (생성/역할 변경은 service role)
create policy "read own profile" on medidash.profiles for select to authenticated using (id = auth.uid() or medidash.is_admin());

-- 작업물/마진: member는 자기 것만, admin 열람
create policy "own works" on medidash.works for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin read works" on medidash.works for select to authenticated using (medidash.is_admin());
create policy "own margin_calcs" on medidash.margin_calcs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
create policy "admin read margin_calcs" on medidash.margin_calcs for select to authenticated using (medidash.is_admin());

-- 결제: 본인·admin 조회만 (기록/갱신은 service role)
create policy "read own payments" on medidash.payments for select to authenticated
  using (user_id = auth.uid() or medidash.is_admin());

-- ── 인덱스 ───────────────────────────────────────────────────

create index idx_subcategories_category on medidash.body_subcategories(category_id);
create index idx_symptoms_subcategory on medidash.symptom_keywords(subcategory_id);
create index idx_symptom_ingredients_ingredient on medidash.symptom_ingredients(ingredient_id);
create index idx_wholesale_source on medidash.wholesale_products(source);
create index idx_wholesale_name on medidash.wholesale_products using gin (to_tsvector('simple', name));
create index idx_works_user on medidash.works(user_id, created_at desc);
create index idx_margin_user on medidash.margin_calcs(user_id, created_at desc);

-- ── PostgREST 접근 권한 (custom schema는 수동 grant 필요) ─────
-- RLS가 실제 행 접근을 통제하며, 아래는 역할이 테이블에 닿을 수 있게 하는 권한.
grant all on all tables in schema medidash to anon, authenticated, service_role;
grant all on all sequences in schema medidash to anon, authenticated, service_role;
alter default privileges in schema medidash grant all on tables to anon, authenticated, service_role;
alter default privileges in schema medidash grant all on sequences to anon, authenticated, service_role;
