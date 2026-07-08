import { NextRequest, NextResponse } from "next/server";
import { Octokit } from "@octokit/rest";

const DATA_PATH = "data/data.json";

export async function POST(req: NextRequest) {
  let body: { passcode?: string; data?: unknown };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Request body must be JSON." }, { status: 400 });
  }

  const { passcode, data } = body;

  const expectedPasscode = process.env.UPDATE_PASSCODE;
  if (!expectedPasscode) {
    return NextResponse.json({ error: "Server is missing UPDATE_PASSCODE configuration." }, { status: 500 });
  }
  if (!passcode || passcode !== expectedPasscode) {
    return NextResponse.json({ error: "Incorrect passcode." }, { status: 401 });
  }

  if (!data || typeof data !== "object") {
    return NextResponse.json({ error: "No data payload received." }, { status: 400 });
  }

  const token = process.env.GITHUB_TOKEN;
  const owner = process.env.GITHUB_OWNER;
  const repo = process.env.GITHUB_REPO;
  const branch = process.env.GITHUB_BRANCH || "main";

  if (!token || !owner || !repo) {
    return NextResponse.json(
      { error: "Server is missing GITHUB_TOKEN / GITHUB_OWNER / GITHUB_REPO configuration." },
      { status: 500 }
    );
  }

  const octokit = new Octokit({ auth: token });

  try {
    let sha: string | undefined;
    try {
      const existing = await octokit.repos.getContent({ owner, repo, path: DATA_PATH, ref: branch });
      if (!Array.isArray(existing.data) && existing.data.type === "file") {
        sha = existing.data.sha;
      }
    } catch (err: any) {
      // 404 just means the file doesn't exist yet on this branch — first commit.
      if (err?.status !== 404) throw err;
    }

    // Stamp the actual commit time server-side — this is what the sidebar's
    // "Data as of" shows, so it must come from the server clock, not
    // whatever the client happened to send (and not a manually-typed cell
    // in the spreadsheet). Returned below so /upload can poll for this exact
    // final JSON to detect when the redeploy carrying it has gone live.
    const finalData = { ...(data as Record<string, unknown>), updatedAt: new Date().toISOString() };
    const content = Buffer.from(JSON.stringify(finalData, null, 2)).toString("base64");

    await octokit.repos.createOrUpdateFileContents({
      owner,
      repo,
      path: DATA_PATH,
      message: "Update dashboard data",
      content,
      sha,
      branch,
    });

    return NextResponse.json({ ok: true, data: finalData });
  } catch (err: any) {
    const status = err?.status;
    let message = err?.message || "Unknown error while committing to GitHub.";
    if (status === 401) message = "GitHub rejected the token — check GITHUB_TOKEN is valid and not expired.";
    else if (status === 403) message = "GitHub token does not have permission to write to this repo (check its contents: read/write scope).";
    else if (status === 404) message = "Repo, branch, or path not found — check GITHUB_OWNER / GITHUB_REPO / GITHUB_BRANCH.";
    else if (status === 409) message = "The file changed on GitHub between read and write — please try again.";
    return NextResponse.json({ error: message }, { status: 502 });
  }
}
