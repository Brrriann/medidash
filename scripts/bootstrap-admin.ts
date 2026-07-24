/**
 * 첫 운영자(admin) 계정 + 초기 수강생 코드 생성.
 * 배포 직후 로그인할 수 있는 계정이 없으므로(가입엔 수강생 코드 필요, admin은 수동 지정),
 * 마이그레이션·시드 후 1회 실행한다.
 *
 * 실행:
 *   npm run bootstrap:admin -- --email=admin@example.com --password='StrongPass123'
 *   npm run bootstrap:admin -- --email=... --password=... --code=MEDI-2026-CLASS --uses=100
 *
 * 필요 env(.env.local): NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
 */
import { readFileSync, existsSync } from "node:fs";
import { resolve } from "node:path";
import { randomBytes } from "node:crypto";
import { createClient } from "@supabase/supabase-js";

loadEnvFiles([".env.local", ".env"]);

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!url || !serviceKey) {
  console.error(
    "❌ NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY 가 필요합니다 (.env.local).",
  );
  process.exit(1);
}

const args = parseArgs(process.argv.slice(2));
if (!args.email || !args.password) {
  console.error(
    "❌ 사용법: npm run bootstrap:admin -- --email=admin@example.com --password='비번8자+'",
  );
  process.exit(1);
}
if (args.password.length < 8) {
  console.error("❌ 비밀번호는 8자 이상이어야 합니다.");
  process.exit(1);
}

const db = createClient(url, serviceKey, {
  db: { schema: "medidash" },
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  // 1) admin 계정 생성 (이미 있으면 조회)
  let userId: string | undefined;
  const { data: created, error: createErr } = await db.auth.admin.createUser({
    email: args.email,
    password: args.password,
    email_confirm: true,
  });
  if (createErr) {
    if (createErr.message?.includes("already")) {
      // 기존 사용자 찾아서 승격
      const { data: list } = await db.auth.admin.listUsers();
      userId = list?.users.find((u) => u.email === args.email)?.id;
      if (!userId) throw new Error(`이미 있는 계정이나 조회 실패: ${args.email}`);
      console.log(`ℹ️  기존 계정 발견 → admin으로 승격: ${args.email}`);
    } else {
      throw new Error(`계정 생성 실패: ${createErr.message}`);
    }
  } else {
    userId = created.user?.id;
    console.log(`✅ admin 계정 생성: ${args.email}`);
  }

  // 2) profiles upsert (role=admin)
  const { error: profileErr } = await db
    .from("profiles")
    .upsert({ id: userId!, email: args.email, role: "admin" }, { onConflict: "id" });
  if (profileErr) throw new Error(`profiles 설정 실패: ${profileErr.message}`);
  console.log("✅ 역할 admin 설정 완료");

  // 3) 초기 수강생 코드 생성
  const code = args.code ?? `MEDI-${randomBytes(2).toString("hex").toUpperCase()}-${randomBytes(2).toString("hex").toUpperCase()}`;
  const maxUses = args.uses ?? 100;
  const { error: codeErr } = await db
    .from("invite_codes")
    .upsert({ code, memo: "부트스트랩 초기 코드", max_uses: maxUses }, { onConflict: "code" });
  if (codeErr) throw new Error(`invite_codes 생성 실패: ${codeErr.message}`);

  console.log(
    [
      "",
      "──────── 완료 ────────",
      `  운영자 로그인 : ${args.email}`,
      `  수강생 코드   : ${code}  (사용 가능 ${maxUses}회)`,
      "",
      "  → 배포 URL에서 위 계정으로 로그인하면 관리자 화면이 보입니다.",
      "  → 수강생에겐 위 코드로 회원가입하도록 안내하세요.",
    ].join("\n"),
  );
}

interface Args {
  email?: string;
  password?: string;
  code?: string;
  uses?: number;
}
function parseArgs(argv: string[]): Args {
  const out: Args = {};
  for (const a of argv) {
    const [k, ...rest] = a.replace(/^--/, "").split("=");
    const v = rest.join("=");
    if (k === "email") out.email = v;
    else if (k === "password") out.password = v;
    else if (k === "code") out.code = v;
    else if (k === "uses") out.uses = Number(v);
  }
  return out;
}

function loadEnvFiles(files: string[]) {
  for (const file of files) {
    const path = resolve(process.cwd(), file);
    if (!existsSync(path)) continue;
    for (const line of readFileSync(path, "utf-8").split("\n")) {
      const m = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
      if (!m) continue;
      const [, key, raw] = m;
      if (process.env[key] !== undefined) continue;
      process.env[key] = raw.replace(/^["']|["']$/g, "");
    }
  }
}

main().catch((e) => {
  console.error("❌ 부트스트랩 실패:", e.message ?? e);
  process.exit(1);
});
