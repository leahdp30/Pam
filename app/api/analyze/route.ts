import { NextRequest, NextResponse } from "next/server";
import { fetchAndParse, extractSections } from "@/lib/analyzer";
import { generateGherkin } from "@/lib/gherkin";
import type { AnalysisResult, AnalyzeErrorResponse } from "@/types/analysis";

export async function POST(
  request: NextRequest,
): Promise<NextResponse<AnalysisResult | AnalyzeErrorResponse>> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Request body must be valid JSON" }, { status: 400 });
  }

  if (!body || typeof body !== "object" || !("url" in body)) {
    return NextResponse.json({ error: "Missing required field: url" }, { status: 400 });
  }

  const rawUrl = (body as Record<string, unknown>).url;
  if (typeof rawUrl !== "string" || rawUrl.trim() === "") {
    return NextResponse.json({ error: "Field 'url' must be a non-empty string" }, { status: 400 });
  }

  const urlString = rawUrl.trim();

  // Validate URL format
  let parsedUrl: URL;
  try {
    parsedUrl = new URL(urlString);
  } catch {
    return NextResponse.json(
      { error: `Invalid URL: "${urlString}". Please include the protocol (e.g. https://example.com)` },
      { status: 400 },
    );
  }

  if (!["http:", "https:"].includes(parsedUrl.protocol)) {
    return NextResponse.json(
      { error: "Only http and https URLs are supported" },
      { status: 400 },
    );
  }

  // Block requests to private/loopback addresses to prevent SSRF
  const hostname = parsedUrl.hostname.toLowerCase();
  if (isPrivateHost(hostname)) {
    return NextResponse.json(
      { error: "Requests to private or loopback addresses are not allowed" },
      { status: 400 },
    );
  }

  // Fetch and parse
  let page;
  try {
    page = await fetchAndParse(parsedUrl.toString());
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return NextResponse.json(
      {
        error: `Failed to fetch the URL: ${message}. The site may be unavailable or block automated requests.`,
      },
      { status: 502 },
    );
  }

  // Extract sections and generate Gherkin
  const sections = extractSections(page);
  for (const section of sections) {
    section.gherkin = generateGherkin(section);
  }

  const siteSummary = buildSiteSummary(page.title, sections.map((s) => s.title));

  const result: AnalysisResult = {
    url: parsedUrl.toString(),
    analyzedAt: new Date().toISOString(),
    siteSummary,
    sections,
  };

  return NextResponse.json(result);
}

function buildSiteSummary(title: string, sectionTitles: string[]): string {
  const listed = sectionTitles.join(", ");
  return `"${title}" was analyzed and the following functional sections were identified: ${listed}.`;
}

/**
 * Returns true when the hostname is a loopback address, private network range,
 * link-local address, or any other internal destination that should not be
 * reachable from a public-facing web application (SSRF guard).
 */
function isPrivateHost(hostname: string): boolean {
  // Loopback / localhost
  if (hostname === "localhost" || hostname === "0.0.0.0") return true;

  // IPv6 loopback
  if (hostname === "::1" || hostname === "[::1]") return true;

  // Strip IPv6 brackets for further checks
  const host = hostname.replace(/^\[|\]$/g, "");

  // IPv4 private / reserved ranges
  const ipv4Parts = host.split(".");
  if (ipv4Parts.length === 4) {
    const [a, b] = ipv4Parts.map(Number);
    if (a === 10) return true;                          // 10.0.0.0/8
    if (a === 172 && b >= 16 && b <= 31) return true;  // 172.16.0.0/12
    if (a === 192 && b === 168) return true;            // 192.168.0.0/16
    if (a === 127) return true;                         // 127.0.0.0/8
    if (a === 169 && b === 254) return true;            // 169.254.0.0/16 link-local
    if (a === 100 && b >= 64 && b <= 127) return true; // 100.64.0.0/10 shared address
    if (a === 0) return true;                           // 0.0.0.0/8
    if (a === 192 && b === 0 && ipv4Parts[2] === "0") return true; // 192.0.0.0/24 IETF
    if (a === 198 && (b === 18 || b === 19)) return true; // 198.18.0.0/15 benchmarking
    if (a === 203 && b === 0 && ipv4Parts[2] === "113") return true; // 203.0.113.0/24 documentation
    if (a === 255) return true;                         // broadcast
  }

  // IPv6 private / link-local / unique-local
  if (host.startsWith("fc") || host.startsWith("fd")) return true; // unique-local fc00::/7
  if (host.startsWith("fe80")) return true;                         // link-local fe80::/10

  return false;
}
