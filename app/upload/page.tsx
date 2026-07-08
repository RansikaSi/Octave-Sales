"use client";

import { useEffect, useRef, useState } from "react";
import { parseWorkbook, type DashboardData } from "@/lib/parseExcel";

type Step = "gate" | "upload";
type SubmitState = "idle" | "submitting" | "deploying" | "live" | "timeout" | "error";

const POLL_INTERVAL_MS = 4000;
const POLL_TIMEOUT_MS = 3 * 60 * 1000; // give Vercel up to 3 minutes to redeploy

export default function UploadPage() {
  const [step, setStep] = useState<Step>("gate");
  const [passcode, setPasscode] = useState("");
  const [checkingPasscode, setCheckingPasscode] = useState(false);
  const [gateError, setGateError] = useState<string | null>(null);

  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<DashboardData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);

  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const [elapsedSec, setElapsedSec] = useState(0);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);
  const elapsedTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
      if (elapsedTimer.current) clearInterval(elapsedTimer.current);
    };
  }, []);

  const onGateSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGateError(null);
    setCheckingPasscode(true);
    try {
      const res = await fetch("/api/verify-passcode", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setGateError(body?.error || "Incorrect passcode.");
        return;
      }
      setStep("upload");
    } catch (err: any) {
      setGateError(err?.message || "Network error — could not verify passcode.");
    } finally {
      setCheckingPasscode(false);
    }
  };

  const handleFile = async (file: File) => {
    setFileName(file.name);
    setParsed(null);
    setParseError(null);
    setSubmitState("idle");
    setSubmitMessage(null);
    try {
      const buf = await file.arrayBuffer();
      const data = parseWorkbook(buf);
      setParsed(data);
    } catch (err: any) {
      setParseError(err?.message || "Could not read that file — is it a valid .xlsx export?");
    }
  };

  const onDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) handleFile(file);
  };

  // Poll the deployed dashboard's data endpoint until it matches what we just
  // committed — that's our signal that Vercel's redeploy actually finished,
  // rather than guessing a fixed delay. Once it matches, hard-redirect home
  // (not client-side nav) so the browser also picks up the new JS bundle.
  const waitForDeployThenRedirect = (submittedJson: string) => {
    const startedAt = Date.now();
    setElapsedSec(0);
    elapsedTimer.current = setInterval(() => setElapsedSec(Math.floor((Date.now() - startedAt) / 1000)), 1000);

    pollTimer.current = setInterval(async () => {
      if (Date.now() - startedAt > POLL_TIMEOUT_MS) {
        if (pollTimer.current) clearInterval(pollTimer.current);
        if (elapsedTimer.current) clearInterval(elapsedTimer.current);
        setSubmitState("timeout");
        setSubmitMessage("Still waiting on the redeploy. It may just be a slow build — check the dashboard in a bit, or visit your Vercel project to see build status.");
        return;
      }
      try {
        const res = await fetch("/api/data", { cache: "no-store" });
        if (!res.ok) return;
        const text = (await res.text()).trim();
        if (text === submittedJson.trim()) {
          if (pollTimer.current) clearInterval(pollTimer.current);
          if (elapsedTimer.current) clearInterval(elapsedTimer.current);
          setSubmitState("live");
          setSubmitMessage("Live! Taking you to the dashboard…");
          setTimeout(() => {
            window.location.href = "/";
          }, 1200);
        }
      } catch {
        // transient network hiccup while polling — just try again next tick
      }
    }, POLL_INTERVAL_MS);
  };

  const onSubmit = async () => {
    if (!parsed) return;
    setSubmitState("submitting");
    setSubmitMessage(null);
    try {
      const res = await fetch("/api/update-data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ passcode, data: parsed }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) {
        setSubmitState("error");
        setSubmitMessage(body?.error || `Update failed (${res.status}).`);
        return;
      }
      setSubmitState("deploying");
      setSubmitMessage("Committed. Waiting for Vercel to redeploy with the new data…");
      waitForDeployThenRedirect(JSON.stringify(parsed, null, 2));
    } catch (err: any) {
      setSubmitState("error");
      setSubmitMessage(err?.message || "Network error — could not reach the update endpoint.");
    }
  };

  const quarterCount = parsed ? Object.keys(parsed.bmByQuarter).length : 0;
  const busy = submitState === "submitting" || submitState === "deploying";

  return (
    <div className="upload-shell">
      <div className="upload-card">
        {step === "gate" && (
          <>
            <div className="upload-title">Update Dashboard Data</div>
            <div className="upload-subtitle">Enter the passcode to continue.</div>
            <form onSubmit={onGateSubmit}>
              <div className="upload-field">
                <label htmlFor="passcode">Passcode</label>
                <input
                  id="passcode"
                  type="password"
                  value={passcode}
                  onChange={(e) => setPasscode(e.target.value)}
                  autoFocus
                  required
                />
              </div>
              {gateError && <div className="upload-status error">{gateError}</div>}
              <button className="upload-btn" type="submit" disabled={checkingPasscode}>
                {checkingPasscode ? "Checking…" : "Continue"}
              </button>
            </form>
          </>
        )}

        {step === "upload" && (
          <>
            <div className="upload-title">Update Dashboard Data</div>
            <div className="upload-subtitle">
              Drop the latest Excel export below, check the preview, then update the live dashboard.
            </div>

            <div
              className={`upload-dropzone${dragOver ? " dragover" : ""}`}
              onClick={() => !busy && fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                if (!busy) setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={busy ? undefined : onDrop}
              style={busy ? { opacity: 0.6, pointerEvents: "none" } : undefined}
            >
              {fileName ? (
                <span>
                  Selected: <strong>{fileName}</strong>
                  <br />
                  Click or drop to choose a different file.
                </span>
              ) : (
                <span>
                  <strong>Drag &amp; drop</strong> your .xlsx file here, or click to browse.
                </span>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: "none" }}
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) handleFile(file);
                  e.target.value = "";
                }}
              />
            </div>

            {parseError && <div className="upload-status error">{parseError}</div>}

            {parsed && (
              <div className="upload-preview">
                Found <b>{parsed.deals.length}</b> deals across <b>{quarterCount}</b> quarter{quarterCount === 1 ? "" : "s"} of business metrics.
                <br />
                <b>{parsed.projects.length}</b> projects, <b>{parsed.partners.length}</b> partners, <b>{parsed.positiveInquiries.length}</b> positive inquir{parsed.positiveInquiries.length === 1 ? "y" : "ies"} logged.
              </div>
            )}

            <button className="upload-btn" disabled={!parsed || busy || submitState === "live"} onClick={onSubmit}>
              {submitState === "submitting" && "Committing…"}
              {submitState === "deploying" && `Deploying… (${elapsedSec}s)`}
              {submitState === "live" && "Done"}
              {(submitState === "idle" || submitState === "error" || submitState === "timeout") && "Update Dashboard"}
            </button>
            {!busy && submitState !== "live" && (
              <button className="upload-btn secondary" type="button" onClick={() => setStep("gate")} style={{ marginTop: 8 }}>
                Back
              </button>
            )}

            {submitState === "deploying" && (
              <div className="upload-status">
                <span className="upload-spinner" aria-hidden="true" /> {submitMessage}
              </div>
            )}
            {submitState === "live" && <div className="upload-status success">{submitMessage}</div>}
            {submitState === "timeout" && <div className="upload-status error">{submitMessage}</div>}
            {submitState === "error" && <div className="upload-status error">{submitMessage}</div>}
          </>
        )}
      </div>
    </div>
  );
}
