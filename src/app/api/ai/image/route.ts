import { NextResponse } from "next/server";
import { getImageProvider } from "@/lib/ai/image";
import { createClient } from "@/lib/supabase/server";
import { isMockMode } from "@/lib/supabase/env";
import { consumeAiQuota } from "@/lib/ai/quota";
import { logAi, type AiKind } from "@/lib/ai/log";

/**
 * AI 이미지 생성 — **서버 액션이 아니라 라우트 핸들러인 이유**
 *
 * 인물 컷아웃은 투명 PNG라 1.5MB이고, 서버 액션으로 돌려주려면 base64 data URL(약 2MB)을
 * RSC 페이로드에 문자열로 실어야 한다. Cloudflare Workers에서 이게 깨졌다 —
 * 배포본에서 배경(193KB)·상품이미지(500KB)는 되는데 인물(2MB)만 조용히 실패했다.
 * (로컬 wrangler dev는 프로덕션 CPU·크기 제한을 강제하지 않아 통과해서 더 늦게 잡혔다.)
 *
 * 라우트 핸들러로 **원본 바이트를 그대로** 내보내면
 *  - RSC 직렬화가 사라지고 (2MB 문자열 처리 = Worker CPU를 크게 먹는 지점)
 *  - 페이로드가 base64 2MB → 바이너리 1.5MB로 줄고
 *  - 같은 출처라 캔버스 오염(taint)도 없다 (blob URL로 그린다)
 *
 * 배경도 같은 경로를 쓴다. 크기가 작아 지금은 서버 액션으로도 되지만, 방식이 둘로 갈리면
 * 나중에 큰 이미지를 서버 액션으로 되돌리는 실수가 다시 난다.
 *
 * ⚠️ `api/`는 middleware matcher에서 제외돼 있으므로 **인증을 여기서 직접 확인**한다.
 */
export const runtime = "nodejs";

export async function POST(req: Request) {
  // middleware가 안 타는 경로라 직접 인증 (mock 모드는 개발·시연용이라 통과)
  if (!isMockMode()) {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (!user) return NextResponse.json({ error: "로그인이 필요합니다." }, { status: 401 });

    // 로그인만으로는 부족하다 — 소셜 계정은 수강생 코드 없이도 만들어진다.
    // 프로필이 있어야(=코드를 냈어야) 유료 API를 쓸 수 있다. 화면 차단(대시보드 레이아웃)만
    // 믿으면 이 엔드포인트를 직접 호출해 우회할 수 있다.
    const { data: profile } = await supabase
      .from("profiles")
      .select("id")
      .eq("id", user.id)
      .maybeSingle();
    if (!profile)
      return NextResponse.json(
        { error: "수강생 코드 확인이 필요합니다." },
        { status: 403 },
      );
  }

  let body: { kind?: string; ingredient?: string; part?: string; persona?: string; outfit?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "요청 형식이 올바르지 않습니다." }, { status: 400 });
  }

  // 유료 호출 직전에 한도 차감 (docs/PRODUCTION-READINESS.md P0-5)
  const quota = await consumeAiQuota("image");
  const kind: AiKind =
    body.kind === "person"
      ? "person_cutout"
      : body.kind === "hook_bg"
        ? "hook_bg"
        : "thumbnail_bg";
  const meta = { ingredient: body.ingredient ?? null, part: body.part ?? null };
  if (!quota.allowed) {
    // 한도 초과도 이력에 남긴다 — 사용자가 마이페이지에서 "왜 안 됐는지"를 볼 수 있어야 한다.
    await logAi(kind, false, { error: quota.reason, meta });
    return NextResponse.json({ error: quota.reason }, { status: 429 });
  }

  try {
    const provider = getImageProvider();
    const bgInput = {
      ingredient: body.ingredient ?? "",
      symptom: body.part || undefined,
      width: 1024,
      height: body.kind === "hook_bg" ? 1536 : 1024,
    };
    const { url } =
      body.kind === "person"
        ? await provider.generatePersonCutout({
            persona: body.persona ?? "40대 남성",
            outfit: body.outfit,
          })
        : body.kind === "hook_bg"
          ? await provider.generateHookBackground(bgInput)
          : await provider.generateThumbnailBackground(bgInput);

    // data:image/png;base64,.... → 원본 바이트로 되돌려 그대로 내보낸다
    const [head, b64] = url.split(",");
    const type = head.match(/^data:([^;]+)/)?.[1] ?? "image/png";
    const bytes = Buffer.from(b64, "base64");

    await logAi(kind, true, { meta: { ...meta, bytes: bytes.byteLength } });

    return new NextResponse(new Uint8Array(bytes), {
      headers: {
        "Content-Type": type,
        "Content-Length": String(bytes.byteLength),
        // 매번 새로 생성되는 1회성 결과 — 캐시하면 안 된다
        "Cache-Control": "no-store",
      },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    console.warn("[api/ai/image] 생성 실패:", msg);
    await logAi(kind, false, { error: msg, meta });
    return NextResponse.json({ error: msg }, { status: 502 });
  }
}
