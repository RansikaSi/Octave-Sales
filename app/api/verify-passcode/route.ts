import { NextRequest, NextResponse } from "next/server";

// Lightweight check used by the /upload gate screen so a wrong passcode is
// caught immediately, before the user bothers picking a file. The real,
// non-bypassable check still happens again in /api/update-data.
export async function POST(req: NextRequest) {
  let body: { passcode?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const expected = process.env.UPDATE_PASSCODE;
  if (!expected) {
    return NextResponse.json({ error: "Server is missing UPDATE_PASSCODE configuration." }, { status: 500 });
  }
  if (!body.passcode || body.passcode !== expected) {
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  return NextResponse.json({ ok: true });
}
