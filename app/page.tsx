"use client";

import { useState, useRef } from "react";
import type { AnalysisResult, Section } from "@/types/analysis";

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function Home() {
  const [url, setUrl] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<AnalysisResult | null>(null);

  async function handleAnalyze(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setResult(null);

    const trimmed = url.trim();
    if (!trimmed) {
      setError("Please enter a URL before analyzing.");
      return;
    }

    setLoading(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: trimmed }),
      });

      const data = await res.json();

      if (!res.ok) {
        setError((data as { error?: string }).error ?? `Request failed with status ${res.status}`);
      } else {
        setResult(data as AnalysisResult);
      }
    } catch (err) {
      setError(
        err instanceof Error
          ? `Network error: ${err.message}`
          : "An unexpected error occurred. Please try again.",
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <header className="site-header">
        <div className="container">
          <span className="site-logo">PAM</span>
          <span className="site-tagline">Product Agile Manager</span>
        </div>
      </header>

      <main>
        <div className="container">
          {/* Input form */}
          <form className="analyze-form" onSubmit={handleAnalyze}>
            <h1>Analyze a Website</h1>
            <p>
              Enter a public URL to extract its functional sections and generate Gherkin stories for
              each one.
            </p>
            <div className="input-row">
              <input
                className="url-input"
                type="url"
                placeholder="https://example.com"
                value={url}
                onChange={(e) => setUrl(e.target.value)}
                disabled={loading}
                aria-label="Website URL"
                autoFocus
              />
              <button className="btn-primary" type="submit" disabled={loading}>
                {loading ? "Analyzing…" : "Analyze"}
              </button>
            </div>
          </form>

          {/* Loading state */}
          {loading && (
            <div className="state-loading" role="status" aria-live="polite">
              <div className="spinner" aria-hidden="true" />
              Fetching and analyzing the site — this may take a few seconds…
            </div>
          )}

          {/* Error state */}
          {error && !loading && (
            <div className="state-error" role="alert">
              {error}
            </div>
          )}

          {/* Results */}
          {result && !loading && <Results result={result} />}
        </div>
      </main>

      <footer className="site-footer">
        <div className="container">
          PAM &mdash; Product Agile Manager &copy; {new Date().getFullYear()}
        </div>
      </footer>
    </>
  );
}

// ---------------------------------------------------------------------------
// Results component
// ---------------------------------------------------------------------------

function Results({ result }: { result: AnalysisResult }) {
  const analyzedAt = new Date(result.analyzedAt).toLocaleString();

  return (
    <div>
      <div className="results-header">
        <h2>Analysis Results</h2>
        <p className="summary">{result.siteSummary}</p>
        <p className="meta">
          URL: <a href={result.url} target="_blank" rel="noopener noreferrer">{result.url}</a>
          {" · "}Analyzed at: {analyzedAt}
        </p>
      </div>

      {result.sections.map((section) => (
        <SectionCard key={section.id} section={section} />
      ))}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Section card (collapsible)
// ---------------------------------------------------------------------------

function SectionCard({ section }: { section: Section }) {
  const [open, setOpen] = useState(true);

  return (
    <div className="section-card">
      <div
        className="section-card-header"
        onClick={() => setOpen((o) => !o)}
        role="button"
        tabIndex={0}
        aria-expanded={open}
        onKeyDown={(e) => e.key === "Enter" && setOpen((o) => !o)}
      >
        <div className="section-title-row">
          <span className="section-title">{section.title}</span>
          <span className={`priority-badge priority-${section.priority}`}>
            {section.priority}
          </span>
        </div>
        <span className={`chevron ${open ? "open" : ""}`}>▼</span>
      </div>

      {open && (
        <div className="section-card-body">
          <p className="section-objective">{section.objective}</p>

          {/* Quick metadata tags */}
          <div className="section-meta">
            {section.uiElements.slice(0, 4).map((el, i) => (
              <span key={i} className="meta-tag">
                {el.type}: {el.labelOrName}
              </span>
            ))}
            {section.dependencies.map((dep, i) => (
              <span key={`dep-${i}`} className="meta-tag">
                dep: {dep}
              </span>
            ))}
          </div>

          {/* Gherkin block */}
          <GherkinBlock gherkin={section.gherkin} sectionTitle={section.title} />
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Gherkin block with copy button
// ---------------------------------------------------------------------------

function GherkinBlock({ gherkin, sectionTitle }: { gherkin: string; sectionTitle: string }) {
  const [copied, setCopied] = useState(false);
  const codeRef = useRef<HTMLPreElement>(null);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(gherkin);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Fallback for environments without clipboard API
      const selection = window.getSelection();
      if (selection && codeRef.current) {
        const range = document.createRange();
        range.selectNodeContents(codeRef.current);
        selection.removeAllRanges();
        selection.addRange(range);
      }
    }
  }

  return (
    <div className="gherkin-block">
      <div className="gherkin-label">
        <span>Gherkin — {sectionTitle}</span>
        <button
          className={`btn-copy ${copied ? "copied" : ""}`}
          onClick={handleCopy}
          type="button"
          aria-label={`Copy Gherkin for ${sectionTitle}`}
        >
          {copied ? "✓ Copied" : "Copy"}
        </button>
      </div>
      <pre className="gherkin-code" ref={codeRef}>
        {gherkin}
      </pre>
    </div>
  );
}
