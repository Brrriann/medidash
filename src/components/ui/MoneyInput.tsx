"use client";

/**
 * 금액 입력칸 — 세 자리마다 콤마를 찍는다.
 *
 * **`type="number"`로는 콤마를 못 찍는다.** 브라우저가 숫자가 아닌 문자를 값으로 받지 않아
 * "24,000"을 넣으면 통째로 무시된다. 그래서 `type="text"` + `inputMode="numeric"`으로
 * 두고 서식과 해석을 직접 한다 — 모바일에서 숫자 키패드는 그대로 뜬다.
 *
 * 자릿수가 안 보이면 24000과 240000을 눈으로 구분하기 어렵다. 도매가·마진은 이미 콤마가
 * 찍혀 나오는데 입력칸만 안 찍혀서 같은 화면에서 표기가 갈렸다.
 * **주 사용자가 50~60대라** 이런 자릿수 오독이 그대로 판매가 실수가 된다.
 *
 * 스피너 화살표가 사라지는 건 오히려 낫다 — 12px짜리 표적이라 어차피 누르기 어려웠다.
 *
 * ponytail: 커서는 항상 끝으로 간다. 가운데를 고치려면 캐럿 위치를 따로 계산해야 하는데,
 * 이 칸은 대개 처음부터 치거나 전체 선택 후 다시 치는 자리라 그대로 둔다.
 */
export function MoneyInput({
  value,
  onChange,
  className,
  "aria-label": ariaLabel,
}: {
  value: number;
  onChange: (n: number) => void;
  className?: string;
  "aria-label"?: string;
}) {
  return (
    <input
      type="text"
      inputMode="numeric"
      value={value.toLocaleString("ko-KR")}
      onChange={(e) => {
        // 숫자만 남긴다 — 콤마·공백·음수 기호가 들어와도 값이 깨지지 않는다
        const digits = e.currentTarget.value.replace(/[^\d]/g, "");
        onChange(digits ? Number(digits) : 0);
      }}
      aria-label={ariaLabel}
      className={className}
    />
  );
}
