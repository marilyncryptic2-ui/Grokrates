import { NextResponse } from "next/server";
import type { RegistryProtocol } from "@/lib/types";
import { loadRegistry, saveRegistry, hasPersistentStore } from "@/lib/store";
import { fetchRegistry } from "@/lib/adapters/registry";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

// Admin API. Disabled entirely unless ADMIN_PASSWORD is set; the
// password arrives as a Bearer token from the /admin page.
function authed(req: Request): boolean {
  const pw = process.env.ADMIN_PASSWORD;
  if (!pw) return false;
  return req.headers.get("authorization") === `Bearer ${pw}`;
}

export async function GET(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const registry = await loadRegistry();
  return NextResponse.json({ registry, persistent: hasPersistentStore() });
}

export async function POST(req: Request) {
  if (!authed(req)) return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  const body = (await req.json()) as { action: "upsert" | "delete" | "preview"; protocol?: RegistryProtocol; id?: string };
  const registry = await loadRegistry();

  if (body.action === "upsert" && body.protocol) {
    const p = { ...body.protocol, id: body.protocol.id || body.protocol.name.toLowerCase().replace(/[^a-z0-9]+/g, "-") };
    const idx = registry.findIndex((x) => x.id === p.id);
    if (idx >= 0) registry[idx] = p; else registry.push({ ...p, active: false }); // new entries start inactive
    await saveRegistry(registry);
    return NextResponse.json({ ok: true, registry });
  }
  if (body.action === "delete" && body.id) {
    await saveRegistry(registry.filter((x) => x.id !== body.id));
    return NextResponse.json({ ok: true });
  }
  if (body.action === "preview") {
    // Run inactive registry adapters and show what their numbers look
    // like BEFORE the admin flips them live.
    const result = await fetchRegistry(true);
    return NextResponse.json({ ok: true, preview: result.opps, warnings: result.warnings });
  }
  return NextResponse.json({ error: "bad request" }, { status: 400 });
}
