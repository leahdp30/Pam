# PAM — Product Agile Manager

PAM is a web application that analyzes any public website URL, extracts its core functional sections, and generates ready-to-use **Gherkin user stories** for each section. It is designed to help product managers, QA engineers, and developers understand and recreate website functionality step by step.

---

## What the MVP does

1. **Input** — paste any public URL into the input field and click **Analyze**.
2. **Fetch & parse** — the backend fetches the page HTML and extracts signals: title, headings, navigation links, forms, buttons, and input types.
3. **Section extraction** — the extracted signals are mapped to logical functional sections (Navigation, Authentication, Content/Browse, Contact/Lead, Search).
4. **Gherkin generation** — each section gets a deterministic, template-based Gherkin `Feature` block with realistic `Scenario / Given / When / Then` steps.
5. **Results view** — sections are displayed as collapsible cards with priority badges, UI element tags, objectives, and a copyable Gherkin code block.

No external AI API key is required — all Gherkin is generated from deterministic templates.

---

## Tech stack

| Layer    | Technology                           |
|----------|--------------------------------------|
| Frontend | Next.js 14 (App Router), React 18    |
| Backend  | Next.js Route Handlers (API routes)  |
| Parsing  | Cheerio (server-side HTML parsing)   |
| Language | TypeScript                           |

---

## How to run

### Prerequisites

- **Node.js** 18 or higher
- **npm** 9 or higher

### Install dependencies

```bash
npm install
```

### Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### Production build

```bash
npm run build
npm start
```

---

## API reference

### `POST /api/analyze`

Analyzes a website URL and returns structured functional sections with Gherkin stories.

#### Request

```http
POST /api/analyze
Content-Type: application/json

{
  "url": "https://example.com"
}
```

#### Success response — `200 OK`

```json
{
  "url": "https://example.com",
  "analyzedAt": "2026-06-29T10:00:00.000Z",
  "siteSummary": "\"Example Domain\" was analyzed and the following functional sections were identified: Navigation, Content / Browse.",
  "sections": [
    {
      "id": "navigation",
      "title": "Navigation",
      "objective": "Allow visitors to navigate between the main sections of the site",
      "priority": "high",
      "uiElements": [
        { "type": "nav", "labelOrName": "Main Navigation", "purpose": "Primary site navigation" }
      ],
      "workflows": [
        {
          "name": "Browse site sections",
          "actors": ["Visitor"],
          "trigger": "User lands on the site",
          "steps": [
            "User sees the main navigation menu",
            "User clicks a navigation item",
            "Browser loads the corresponding page or section"
          ],
          "outcomes": ["The target page or section is displayed"],
          "edgeCases": ["Navigation item links to an external URL"]
        }
      ],
      "dependencies": ["Router", "Layout component"],
      "acceptanceCriteria": [
        "Navigation is visible on all pages",
        "Active link is visually highlighted",
        "All navigation links resolve to valid pages",
        "Navigation is accessible on mobile devices"
      ],
      "rebuildProcedure": [
        { "order": 1, "instruction": "Create a responsive navigation bar component", "technicalHint": "Use <nav> element with aria-label" },
        { "order": 2, "instruction": "Add navigation links for each main section" },
        { "order": 3, "instruction": "Implement active-link highlighting for current page" },
        { "order": 4, "instruction": "Add mobile hamburger menu for small viewports" }
      ],
      "gherkin": "Feature: Navigation\n  # Allow visitors to navigate between the main sections of the site\n\n  Scenario: Visitor views the main navigation menu\n    Given the visitor opens the site homepage\n    Then a navigation menu is visible\n    And the menu contains links to the main sections\n  ..."
    }
  ]
}
```

#### Error responses

| Status | Condition                          | Body                                                  |
|--------|------------------------------------|-------------------------------------------------------|
| `400`  | Missing or invalid `url` field     | `{ "error": "..." }`                                  |
| `400`  | Non-http/https protocol            | `{ "error": "Only http and https URLs are supported" }` |
| `502`  | Target URL unreachable or timed out | `{ "error": "Failed to fetch the URL: ..." }`         |

---

## Data contract

The full TypeScript interface is defined in [`types/analysis.ts`](./types/analysis.ts).

Key types:

```ts
interface AnalysisResult {
  url: string;
  analyzedAt: string;          // ISO 8601
  siteSummary: string;
  sections: Section[];
}

interface Section {
  id: string;
  title: string;
  objective: string;
  priority: "high" | "medium" | "low";
  uiElements: UIElement[];
  workflows: Workflow[];
  dependencies: string[];
  acceptanceCriteria: string[];
  rebuildProcedure: RebuildStep[];
  gherkin: string;             // full Gherkin Feature text
}
```

---

## Project structure

```
├── app/
│   ├── api/analyze/route.ts   # POST /api/analyze handler
│   ├── globals.css            # Global styles
│   ├── layout.tsx             # Root layout
│   └── page.tsx               # Frontend page (URL input + results)
├── lib/
│   ├── analyzer.ts            # HTML fetch, parse, section extraction
│   └── gherkin.ts             # Deterministic Gherkin template generator
├── types/
│   └── analysis.ts            # TypeScript interfaces / data contract
├── next.config.js
├── tsconfig.json
└── package.json
```
