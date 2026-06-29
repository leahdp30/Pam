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
