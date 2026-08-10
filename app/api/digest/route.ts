import { NextResponse } from "next/server";
import { getSnapshot } from "@/lib/pipeline";
import { buildDigestThread, sendDailyDigest } from "@/lib/alerts/telegram";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

export async function GET(req: Request) {
  const secret = process.env.CRON_SECRET;
  if (secret && req.headers.get("authorization") !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }
  try {
    const s = await getSnapshot();
    const sent = await sendDailyDigest(s);
    return NextResponse.json({ ok: true, sent, draft: buildDigestThread(s) });
  } catch (e) {
    return NextResponse.json({ ok: false, error: String(e) }, { status: 500 });
  }
}
