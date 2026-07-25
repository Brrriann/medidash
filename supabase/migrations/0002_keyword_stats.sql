-- 키워드 수요·경쟁 지표 (네이버 데이터랩 + 쇼핑검색)
--
-- 상품명 노출도를 실측 기반으로 매기기 위한 캐시. broadcast_stats와 같은 월1회 배치 패턴이라
-- 앱 런타임에서 네이버 API를 부르지 않는다(Workers 런타임 부담 0, 앱에 네이버 키 불필요).
--
-- demand_index: 데이터랩 12개월 검색 트렌드 평균을 앵커 키워드("콜라겐") 대비 비율로 정규화한 값.
--   데이터랩은 한 요청당 그룹 5개 + 값이 그룹 내 상대값이라 배치끼리 비교가 안 된다.
--   그래서 매 배치에 같은 앵커를 끼워 넣고 앵커=1.0 기준으로 환산했다. 1.0 초과도 가능.
-- competition: 네이버쇼핑 등록 상품수. 클수록 묻히기 쉽다.
-- related_keywords: 그 키워드로 검색했을 때 상위 노출 상품명에 함께 쓰인 어휘와 등장 횟수
--   ([{term, count}]). "상위에 뜨는 상품들이 실제로 쓰는 단어" = 상품명 연관도의 근거.
create table medidash.keyword_stats (
  id bigserial primary key,
  keyword text not null,
  kind text check (kind in ('ingredient', 'brand')),
  demand_index numeric,
  competition int,
  related_keywords jsonb,
  collected_at timestamptz,
  unique (keyword, kind)
);

alter table medidash.keyword_stats enable row level security;

create policy "read keyword stats" on medidash.keyword_stats
  for select to authenticated using (true);
create policy "admin write keyword stats" on medidash.keyword_stats
  for all to authenticated using (medidash.is_admin()) with check (medidash.is_admin());
