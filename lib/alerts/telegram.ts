import type { Snapshot } from "../types";

// No-ops silently when env vars are blank (Telegram is deferred).
export async function sendTelegram(text: string): Promise<boolean> {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return false;
  const res = await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, disable_web_page_preview: true }),
  });
  return res.ok;
}

// Daily digest thread draft — @marilyn100x format: 0/ hook, full
// declarative sentences, ">" bullets no gaps, DYOR close, no hashtags,
// no em-dashes, no fragments.
export function buildDigestThread(s: Snapshot): string {
  if (!s.top10.length) return "No qualifying pools passed the filters today.";
  const best = s.top10[0];
  const lines: string[] = [];
  lines.push(`0/ The best rate on the board today is ${best.effectiveApy}% on ${best.asset} via ${best.venue}.`);
  lines.push("");
  lines.push("Every number below is the realized 30 day rate where history exists, not the advertised one. Every pool holds more than 10 million dollars.");
  lines.push("");
  for (const e of s.top10) {
    const strat = e.strategyLabel ? e.strategyLabel.toLowerCase() : "base rate";
    lines.push(`> ${e.asset} on ${e.venue} (${e.chain}) pays ${e.effectiveApy}% as a ${strat}.`);
  }
  lines.push("");
  lines.push("Rates refresh every 2 hours on the site. DYOR.");
  return lines.join("\n");
}

export async function sendDailyDigest(s: Snapshot): Promise<boolean> {
  return sendTelegram(buildDigestThread(s));
}
