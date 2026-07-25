-- 홈쇼핑 방송 예정 + 방송 메타(채널·일시) 보존
--
-- 종전엔 최근 방송 상품명(문자열)만 모았다. 홈쇼핑모아 검색 응답에는 방송 **예정**(future)과
-- 각 방송의 채널·시작일시가 함께 들어 있는데 전부 버리고 있었다.
-- 셀러에게는 "이미 나간 방송"보다 "앞으로 나갈 방송"이 쓸모 있다 — 지금 소싱하면
-- 수요가 오르는 구간에 올라탈 수 있기 때문이다.
--
-- recent_titles는 이미 jsonb라 스키마 변경 없이 [{name, channel, at}] 구조로 바뀐다.
-- 기존 행은 문자열 배열이므로 읽는 쪽이 두 형태를 모두 받는다(재크롤하면 덮어써진다).
alter table medidash.broadcast_stats
  add column if not exists upcoming jsonb not null default '[]'::jsonb;

comment on column medidash.broadcast_stats.upcoming is
  '방송 예정 상품 [{name, channel, at}] — hsmoa aggregatedData.future (상위 10건)';
comment on column medidash.broadcast_stats.recent_titles is
  '최근 방송 상품 [{name, channel, at}] — hsmoa aggregatedData.past (상위 10건)';
