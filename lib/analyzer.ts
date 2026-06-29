import * as cheerio from "cheerio";
import type { Section, UIElement, Workflow, RebuildStep } from "@/types/analysis";

interface ExtractedPage {
  title: string;
  headings: string[];
  navLinks: string[];
  forms: { id: string; inputs: string[]; buttons: string[] }[];
  buttons: string[];
  links: string[];
  hasPasswordField: boolean;
  hasSearchField: boolean;
  hasEmailField: boolean;
}

export async function fetchAndParse(url: string): Promise<ExtractedPage> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 10_000);

  let html: string;
  try {
    const response = await fetch(url, {
      signal: controller.signal,
      headers: {
        "User-Agent":
          "Mozilla/5.0 (compatible; PamBot/1.0; +https://github.com/leahdp30/Pam)",
      },
    });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status} from ${url}`);
    }
    html = await response.text();
  } finally {
    clearTimeout(timeout);
  }

  return parseHtml(html);
}

export function parseHtml(html: string): ExtractedPage {
  const $ = cheerio.load(html);

  const title = $("title").first().text().trim() || $("h1").first().text().trim() || "Untitled Site";

  const headings: string[] = [];
  $("h1, h2, h3").each((_, el) => {
    const text = $(el).text().trim();
    if (text) headings.push(text);
  });

  const navLinks: string[] = [];
  $("nav a, header a, [role='navigation'] a").each((_, el) => {
    const text = $(el).text().trim();
    if (text) navLinks.push(text);
  });

  const forms: ExtractedPage["forms"] = [];
  $("form").each((i, el) => {
    const inputs: string[] = [];
    $(el)
      .find("input, textarea, select")
      .each((_, input) => {
        const label =
          $(input).attr("placeholder") ||
          $(input).attr("name") ||
          $(input).attr("id") ||
          $(input).attr("type") ||
          "field";
        inputs.push(label);
      });

    const buttons: string[] = [];
    $(el)
      .find("button, input[type='submit']")
      .each((_, btn) => {
        const label =
          $(btn).text().trim() ||
          $(btn).attr("value") ||
          $(btn).attr("aria-label") ||
          "Submit";
        if (label) buttons.push(label);
      });

    forms.push({ id: `form-${i + 1}`, inputs, buttons });
  });

  const buttons: string[] = [];
  $("button, [role='button'], input[type='button'], input[type='submit']").each((_, el) => {
    const label =
      $(el).text().trim() ||
      $(el).attr("value") ||
      $(el).attr("aria-label") ||
      "";
    if (label) buttons.push(label);
  });

  const links: string[] = [];
  $("a[href]").each((_, el) => {
    const text = $(el).text().trim();
    if (text && text.length < 60) links.push(text);
  });

  const allInputTypes = $("input")
    .map((_, el) => ($(el).attr("type") || "text").toLowerCase())
    .get();

  const allInputNames = $("input, textarea")
    .map((_, el) => ($(el).attr("name") || $(el).attr("id") || "").toLowerCase())
    .get();

  const hasPasswordField = allInputTypes.includes("password");
  const hasEmailField =
    allInputTypes.includes("email") ||
    allInputNames.some((n) => n.includes("email"));
  const hasSearchField =
    allInputTypes.includes("search") ||
    allInputNames.some((n) => n.includes("search") || n.includes("query") || n.includes("q"));

  return {
    title: title.slice(0, 120),
    headings: dedupe(headings).slice(0, 20),
    navLinks: dedupe(navLinks).slice(0, 20),
    forms,
    buttons: dedupe(buttons).slice(0, 20),
    links: dedupe(links).slice(0, 30),
    hasPasswordField,
    hasSearchField,
    hasEmailField,
  };
}

function dedupe(arr: string[]): string[] {
  return [...new Set(arr.map((s) => s.trim()).filter(Boolean))];
}

// ---------------------------------------------------------------------------
// Section extraction
// ---------------------------------------------------------------------------

export function extractSections(page: ExtractedPage): Section[] {
  const sections: Section[] = [];

  // Navigation section — always include if nav links exist or site has headings
  if (page.navLinks.length > 0 || page.headings.length > 0) {
    sections.push(buildNavigationSection(page));
  }

  // Authentication section — include when login/signup signals found
  if (
    page.hasPasswordField ||
    page.hasEmailField ||
    containsKeyword(page.buttons, ["login", "sign in", "sign up", "register", "log in"]) ||
    containsKeyword(page.links, ["login", "sign in", "sign up", "register", "log in"])
  ) {
    sections.push(buildAuthSection(page));
  }

  // Contact/Lead section — contact form signals
  if (
    containsKeyword(page.buttons, ["contact", "send", "submit", "get in touch", "subscribe"]) ||
    containsKeyword(page.links, ["contact", "contact us"]) ||
    (page.forms.length > 0 && !page.hasPasswordField)
  ) {
    sections.push(buildContactSection(page));
  }

  // Content/Browse section — always include as a general content section
  sections.push(buildContentSection(page));

  // Search section — only when search signals found
  if (page.hasSearchField || containsKeyword(page.buttons, ["search"])) {
    sections.push(buildSearchSection(page));
  }

  // Ensure we always have at least 2 sections
  if (sections.length < 2) {
    sections.push(buildContentSection(page));
  }

  // Deduplicate by id
  const seen = new Set<string>();
  return sections.filter((s) => {
    if (seen.has(s.id)) return false;
    seen.add(s.id);
    return true;
  });
}

function containsKeyword(arr: string[], keywords: string[]): boolean {
  return arr.some((item) =>
    keywords.some((kw) => item.toLowerCase().includes(kw))
  );
}

// ---------------------------------------------------------------------------
// Section builders
// ---------------------------------------------------------------------------

function buildNavigationSection(page: ExtractedPage): Section {
  const navItems = page.navLinks.length > 0 ? page.navLinks : page.headings.slice(0, 5);

  const uiElements: UIElement[] = [
    { type: "nav", labelOrName: "Main Navigation", purpose: "Primary site navigation" },
    ...navItems.slice(0, 5).map<UIElement>((label) => ({
      type: "link",
      labelOrName: label,
      purpose: `Navigate to ${label} section`,
    })),
  ];

  const workflows: Workflow[] = [
    {
      name: "Browse site sections",
      actors: ["Visitor"],
      trigger: "User lands on the site",
      steps: [
        "User sees the main navigation menu",
        "User clicks a navigation item",
        "Browser loads the corresponding page or section",
      ],
      outcomes: ["The target page or section is displayed"],
      edgeCases: ["Navigation item links to an external URL"],
    },
  ];

  const rebuildProcedure: RebuildStep[] = [
    { order: 1, instruction: "Create a responsive navigation bar component", technicalHint: "Use <nav> element with aria-label" },
    { order: 2, instruction: "Add navigation links for each main section", technicalHint: navItems.slice(0, 5).map((l) => `'${l}'`).join(", ") || "Home, About, Contact" },
    { order: 3, instruction: "Implement active-link highlighting for current page" },
    { order: 4, instruction: "Add mobile hamburger menu for small viewports" },
  ];

  return {
    id: "navigation",
    title: "Navigation",
    objective: "Allow visitors to navigate between the main sections of the site",
    priority: "high",
    uiElements,
    workflows,
    dependencies: ["Router", "Layout component"],
    acceptanceCriteria: [
      "Navigation is visible on all pages",
      "Active link is visually highlighted",
      "All navigation links resolve to valid pages",
      "Navigation is accessible on mobile devices",
    ],
    rebuildProcedure,
    gherkin: "",
  };
}

function buildAuthSection(page: ExtractedPage): Section {
  const hasSignup =
    containsKeyword(page.buttons, ["sign up", "register", "create account"]) ||
    containsKeyword(page.links, ["sign up", "register", "create account"]);

  const uiElements: UIElement[] = [
    { type: "form", labelOrName: "Login Form", purpose: "Authenticate existing users" },
    { type: "input", labelOrName: "Email/Username", selectorHint: "input[type='email'], input[name='email']", purpose: "Capture user identifier" },
    { type: "input", labelOrName: "Password", selectorHint: "input[type='password']", purpose: "Capture secret credential" },
    { type: "button", labelOrName: "Login / Sign In", selectorHint: "button[type='submit']", purpose: "Submit credentials" },
  ];

  if (hasSignup) {
    uiElements.push({ type: "link", labelOrName: "Sign Up / Register", purpose: "Route to registration flow" });
  }

  const workflows: Workflow[] = [
    {
      name: "User login",
      actors: ["Registered User"],
      trigger: "User navigates to login page",
      steps: [
        "User enters email/username",
        "User enters password",
        "User clicks Sign In button",
        "System validates credentials",
      ],
      outcomes: ["User is authenticated and redirected to dashboard or home page"],
      edgeCases: ["Invalid credentials", "Account locked after repeated failures", "Forgotten password flow"],
    },
  ];

  if (hasSignup) {
    workflows.push({
      name: "User registration",
      actors: ["Visitor"],
      trigger: "User clicks Sign Up / Register link",
      steps: [
        "User fills in registration form",
        "User accepts terms if prompted",
        "User submits the form",
        "System creates a new account",
      ],
      outcomes: ["Account is created and user is redirected or shown confirmation"],
      edgeCases: ["Email already in use", "Password too weak"],
    });
  }

  const rebuildProcedure: RebuildStep[] = [
    { order: 1, instruction: "Create login page with email and password fields" },
    { order: 2, instruction: "Implement credential validation on the backend" },
    { order: 3, instruction: "Issue a session token or JWT on successful login" },
    { order: 4, instruction: "Redirect authenticated user to the protected area" },
    { order: 5, instruction: "Display clear error messages on authentication failure" },
    ...(hasSignup
      ? [{ order: 6, instruction: "Build registration form and unique-email validation" }]
      : []),
  ];

  return {
    id: "authentication",
    title: "Authentication",
    objective: "Securely identify users and control access to protected resources",
    priority: "high",
    uiElements,
    workflows,
    dependencies: ["Session management", "User datastore", "Password hashing"],
    acceptanceCriteria: [
      "Valid credentials grant access to protected routes",
      "Invalid credentials display an error message without leaking information",
      "User session persists across page refreshes",
      "Users can log out and invalidate their session",
    ],
    rebuildProcedure,
    gherkin: "",
  };
}

function buildContactSection(page: ExtractedPage): Section {
  const formInputs =
    page.forms.length > 0 ? page.forms[0].inputs : ["name", "email", "message"];

  const uiElements: UIElement[] = [
    { type: "form", labelOrName: "Contact Form", purpose: "Capture visitor inquiries" },
    ...formInputs.slice(0, 4).map<UIElement>((label) => ({
      type: "input",
      labelOrName: label,
      purpose: `Collect ${label} from visitor`,
    })),
    { type: "button", labelOrName: "Submit / Send", purpose: "Submit contact form" },
  ];

  const workflows: Workflow[] = [
    {
      name: "Submit contact form",
      actors: ["Visitor"],
      trigger: "User navigates to contact or lead form",
      steps: [
        "User fills in required fields (name, email, message)",
        "User clicks the submit button",
        "System validates the form inputs",
        "System sends the inquiry to the site owner",
      ],
      outcomes: ["Visitor receives a confirmation message", "Site owner receives the inquiry"],
      edgeCases: ["Required field left blank", "Invalid email format", "Spam submission"],
    },
  ];

  const rebuildProcedure: RebuildStep[] = [
    { order: 1, instruction: "Create contact/lead form with required fields" },
    { order: 2, instruction: "Implement server-side validation for all inputs" },
    { order: 3, instruction: "Send notification email or store inquiry in database" },
    { order: 4, instruction: "Show success confirmation after form submission" },
    { order: 5, instruction: "Add spam protection (honeypot or CAPTCHA)" },
  ];

  return {
    id: "contact",
    title: "Contact / Lead Capture",
    objective: "Allow visitors to submit inquiries or expressions of interest",
    priority: "medium",
    uiElements,
    workflows,
    dependencies: ["Email service or CRM", "Form validation library"],
    acceptanceCriteria: [
      "All required fields are validated before submission",
      "A success message is displayed on successful submission",
      "Incomplete or invalid forms display inline error messages",
      "Submitted data is recorded or forwarded to the site owner",
    ],
    rebuildProcedure,
    gherkin: "",
  };
}

function buildContentSection(page: ExtractedPage): Section {
  const mainHeadings = page.headings.slice(0, 5);
  const siteTitle = page.title;

  const uiElements: UIElement[] = [
    { type: "card", labelOrName: "Content Cards", purpose: "Display content items or listings" },
    { type: "link", labelOrName: "Read More / Detail Links", purpose: "Navigate to full content item" },
  ];

  if (mainHeadings.length > 0) {
    uiElements.unshift({
      type: "other",
      labelOrName: mainHeadings[0],
      purpose: "Primary content heading",
    });
  }

  const workflows: Workflow[] = [
    {
      name: "Browse content",
      actors: ["Visitor"],
      trigger: "User opens the site or navigates to a content listing page",
      steps: [
        "User sees a list or grid of content items",
        "User scrolls through or filters items",
        "User clicks on an item to view its details",
      ],
      outcomes: ["Full content item is displayed"],
      edgeCases: ["No content available", "Content item no longer exists (404)"],
    },
  ];

  const rebuildProcedure: RebuildStep[] = [
    { order: 1, instruction: `Create main content area for '${siteTitle}'` },
    { order: 2, instruction: "Implement a content listing page with pagination or infinite scroll" },
    { order: 3, instruction: "Build a content detail page" },
    { order: 4, instruction: "Ensure content is accessible and readable on all screen sizes" },
  ];

  return {
    id: "content",
    title: "Content / Browse",
    objective: "Present the site's primary content and allow visitors to browse it",
    priority: "high",
    uiElements,
    workflows,
    dependencies: ["Content datastore or CMS", "Routing"],
    acceptanceCriteria: [
      "Content listing is displayed on page load",
      "Clicking an item navigates to its detail view",
      "Empty state is handled gracefully",
      "Content is legible on mobile and desktop",
    ],
    rebuildProcedure,
    gherkin: "",
  };
}

function buildSearchSection(page: ExtractedPage): Section {
  const uiElements: UIElement[] = [
    { type: "input", labelOrName: "Search Input", selectorHint: "input[type='search']", purpose: "Accept search query from user" },
    { type: "button", labelOrName: "Search Button", purpose: "Submit search query" },
    { type: "table", labelOrName: "Search Results List", purpose: "Display matching results" },
  ];

  const workflows: Workflow[] = [
    {
      name: "Search for content",
      actors: ["Visitor"],
      trigger: "User focuses on the search field",
      steps: [
        "User types a search query",
        "User submits the search (Enter key or button click)",
        "System fetches and filters matching results",
        "Results are displayed in a list",
      ],
      outcomes: ["Matching results are listed", "No-results state shown when nothing matches"],
      edgeCases: ["Empty query submitted", "Special characters in query", "Very large result set"],
    },
  ];

  const rebuildProcedure: RebuildStep[] = [
    { order: 1, instruction: "Add a search input field in the header or dedicated search page" },
    { order: 2, instruction: "Implement server-side or client-side search/filter logic" },
    { order: 3, instruction: "Display results with relevant metadata (title, snippet, link)" },
    { order: 4, instruction: "Handle empty state with a helpful message" },
  ];

  return {
    id: "search",
    title: "Search",
    objective: "Enable visitors to find specific content using a keyword search",
    priority: "medium",
    uiElements,
    workflows,
    dependencies: ["Search index or database full-text search", "Content datastore"],
    acceptanceCriteria: [
      "Submitting a valid query returns relevant results",
      "Empty queries are rejected with an informative message",
      "No-results state is clearly communicated",
      "Results link back to the corresponding content items",
    ],
    rebuildProcedure,
    gherkin: "",
  };
}
