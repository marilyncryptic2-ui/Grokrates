import { NextResponse } from "next/server";
import { refreshSnapshot } from "@/lib/pipeline";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const s = await refreshSnapshot();
    return NextResponse.json({ ok: true, updatedAt: s.updatedAt, pools: s.poolCount, warnings: s.warnings.length });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
