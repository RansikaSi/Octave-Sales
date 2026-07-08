import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// GET handler for the current dashboard dataset. app/page.tsx doesn't use
// this (it imports data/data.json directly at build time so there's zero
// fetch latency / no flash of stale numbers) but /upload polls it after
// submitting an update, to detect the moment Vercel's redeploy has actually
// gone live — force-dynamic + no-store so it's never served from a cache
// left over from a previous deployment.
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "data.json");
    const raw = await readFile(filePath, "utf-8");
    return new NextResponse(raw, {
      headers: { "Content-Type": "application/json", "Cache-Control": "no-store" },
    });
  } catch {
    return NextResponse.json({ error: "data.json not found" }, { status: 404 });
  }
}
