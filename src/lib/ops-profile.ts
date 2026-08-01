/**
 * 셀러 운영 프로필 — CS 답변 생성의 입력.
 *
 * **왜 필요한가**: "배송 언제 오나요"에 일반론으로 답하면 그대로 클레임이 된다.
 * 그 셀러의 배송·교환 정책을 알아야 쓸 수 있는 답이 나온다. 그래서 프로필이 비어 있으면
 * 채팅 입력을 막는다 — 쓸모없는 답을 내놓느니 세팅을 먼저 시키는 편이 낫다.
 *
 * `profiles.ops_profile` jsonb 한 칸에 담는다. 항목이 늘 때마다 마이그레이션을 하지
 * 않기 위해서다. 서버·클라이언트가 함께 쓰므로 이 파일에 server-only를 두지 않는다.
 */

/** 판매 채널 — 같은 상품을 여러 몰에 올리는 게 일반적이라 배열로 둔다 */
export interface SalesChannel {
  /** "쿠팡", "스마트스토어", "11번가" 등 */
  platform: string;
  /** 그 몰에서 쓰는 스토어명 — 고객이 이 이름으로 문의한다 */
  storeName: string;
  url: string;
}

export interface OpsProfile {
  /** 브랜드/상호명 — 답변 서명에 쓴다 */
  brandName: string;
  /** 취급 카테고리 (예: 건강기능식품) */
  category: string;
  channels: SalesChannel[];
  /** 배송 정책 — 출고 시점·택배사·배송비 */
  shipping: string;
  /** 교환·반품 정책 */
  returns: string;
  /** 그 밖에 답변에 반영할 것 (말투, 자주 나가는 안내) */
  notes: string;
}

export const EMPTY_OPS_PROFILE: OpsProfile = {
  brandName: "",
  category: "건강기능식품",
  channels: [],
  shipping: "",
  returns: "",
  notes: "",
};

const str = (v: unknown): string => (typeof v === "string" ? v.trim() : "");

/** jsonb에서 읽은 값을 안전하게 OpsProfile로. 필드가 없거나 형이 달라도 죽지 않는다. */
export function toOpsProfile(raw: unknown): OpsProfile {
  const o = (raw ?? {}) as Record<string, unknown>;
  return {
    brandName: str(o.brandName),
    category: str(o.category) || "건강기능식품",
    channels: Array.isArray(o.channels)
      ? o.channels
          .map((c) => {
            const x = (c ?? {}) as Record<string, unknown>;
            return {
              platform: str(x.platform),
              storeName: str(x.storeName),
              url: str(x.url),
            };
          })
          .filter((c) => c.platform || c.storeName)
      : [],
    shipping: str(o.shipping),
    returns: str(o.returns),
    notes: str(o.notes),
  };
}

/**
 * CS 답변을 만들 수 있는 최소 조건.
 *
 * 상호명과 배송 정책 둘은 반드시 있어야 한다 — 문의의 대부분이 배송이고, 답변에는
 * 어느 스토어인지가 들어가야 한다. 교환·반품은 없으면 그 주제만 일반론으로 답한다.
 */
export function isOpsProfileReady(p: OpsProfile): boolean {
  return p.brandName.length > 0 && p.shipping.length > 0;
}

/** 비어 있는 필수 항목 이름 — 화면에 무엇을 채워야 하는지 보여준다 */
export function missingOpsFields(p: OpsProfile): string[] {
  const out: string[] = [];
  if (!p.brandName) out.push("브랜드/상호명");
  if (!p.shipping) out.push("배송 정책");
  return out;
}
