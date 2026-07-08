"use client";

import { useRef, useState } from "react";
import { parseWorkbook, type DashboardData } from "@/lib/parseExcel";

type Step = "gate" | "upload";
type SubmitState = "idle" | "submitting" | "success" | "error";

export default function UploadPage() {
  const [step, setStep] = useState<Step>("gate");
  const [passcode, setPasscode] = useState("");
  const [dragOver, setDragOver] = useState(false);
  const [fileName, setFileName] = useState<string | null>(null);
  const [parsed, setParsed] = useState<DashboardData | null>(null);
  const [parseError, setParseError] = useState<string | null>(null);
  const [submitState, setSubmitState] = useState<SubmitState>("idle");
  const [submitMessage, setSubmitMessage] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

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
      setSubmitState("success");
      setSubmitMessage("Dashboard updating — live in about a minute.");
    } catch (err: any) {
      setSubmitState("error");
      setSubmitMessage(err?.message || "Network error — could not reach the update endpoint.");
    }
  };

  const quarterCount = parsed ? Object.keys(parsed.bmByQuarter).length : 0;

  return (
    <div className="upload-shell">
      <div className="upload-card">
        {step === "gate" && (
          <>
            <div className="upload-title">Update Dashboard Data</div>
            <div className="upload-subtitle">Enter the passcode to continue.</div>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                setStep("upload");
              }}
            >
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
              <button className="upload-btn" type="submit">
                Continue
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
              onClick={() => fileInputRef.current?.click()}
              onDragOver={(e) => {
                e.preventDefault();
                setDragOver(true);
              }}
              onDragLeave={() => setDragOver(false)}
              onDrop={onDrop}
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

            <button className="upload-btn" disabled={!parsed || submitState === "submitting"} onClick={onSubmit}>
              {submitState === "submitting" ? "Updating…" : "Update Dashboard"}
            </button>
            <button
              className="upload-btn secondary"
              type="button"
              onClick={() => setStep("gate")}
              style={{ marginTop: 8 }}
            >
              Back
            </button>

            {submitState === "success" && <div className="upload-status success">{submitMessage}</div>}
            {submitState === "error" && <div className="upload-status error">{submitMessage}</div>}
          </>
        )}
      </div>
    </div>
  );
}
