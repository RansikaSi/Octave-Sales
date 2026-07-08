import { NextResponse } from "next/server";
import { readFile } from "fs/promises";
import path from "path";

// GET handler for the current dashboard dataset. Not used by app/page.tsx
// today (it imports data/data.json directly at build time so there's zero
// fetch latency / no flash of stale numbers), but kept available per the
// project structure for cache-busting or auth needs later.
export async function GET() {
  try {
    const filePath = path.join(process.cwd(), "data", "data.json");
    const raw = await readFile(filePath, "utf-8");
    return new NextResponse(raw, {
      headers: { "Content-Type": "application/json" },
    });
  } catch {
    return NextResponse.json({ error: "data.json not found" }, { status: 404 });
  }
}
