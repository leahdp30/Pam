import type { Section } from "@/types/analysis";

const MAX_OBJECTIVE_LENGTH = 200;

/**
 * Generates deterministic Gherkin feature text for a given section.
 * Template-based — no external AI required.
 */
export function generateGherkin(section: Section): string {
  if (section.id.startsWith("article-")) {
    return gherkinArticleSection(section);
  }

  switch (section.id) {
    case "navigation":
      return gherkinNavigation(section);
    case "authentication":
      return gherkinAuthentication(section);
    case "contact":
      return gherkinContact(section);
    case "content":
      return gherkinContent(section);
    case "search":
      return gherkinSearch(section);
    default:
      return gherkinGeneric(section);
  }
}

// ---------------------------------------------------------------------------
// Template helpers
// ---------------------------------------------------------------------------

function indent(text: string, spaces = 2): string {
  return text
    .split("\n")
    .map((line) => (line.trim() === "" ? "" : " ".repeat(spaces) + line))
    .join("\n");
}

function block(...lines: string[]): string {
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Per-section templates
// ---------------------------------------------------------------------------

function gherkinNavigation(s: Section): string {
  const navItems = s.uiElements
    .filter((e) => e.type === "link")
    .map((e) => e.labelOrName)
    .slice(0, 3);

  const firstNav = navItems[0] || "Home";
  const secondNav = navItems[1] || "About";

  return block(
    `Feature: ${s.title}`,
    `  # ${s.objective}`,
    ``,
    `  Scenario: Visitor views the main navigation menu`,
    `    Given the visitor opens the site homepage`,
    `    Then a navigation menu is visible`,
    `    And the menu contains links to the main sections`,
    ``,
    `  Scenario: Visitor navigates to a section via the menu`,
    `    Given the visitor is on any page of the site`,
    `    When the visitor clicks the "${firstNav}" navigation link`,
    `    Then the browser loads the "${firstNav}" page`,
    `    And the "${firstNav}" link appears highlighted as active`,
    ``,
    `  Scenario: Visitor navigates to another section`,
    `    Given the visitor is viewing the "${firstNav}" page`,
    `    When the visitor clicks the "${secondNav}" navigation link`,
    `    Then the browser loads the "${secondNav}" page`,
    ``,
    `  Scenario: Navigation is accessible on mobile`,
    `    Given the visitor opens the site on a mobile device`,
    `    Then a hamburger or compact menu icon is visible`,
    `    When the visitor taps the menu icon`,
    `    Then the navigation links expand and are tappable`,
  );
}

function gherkinAuthentication(s: Section): string {
  const hasSignup = s.workflows.some((w) => w.name.toLowerCase().includes("registr"));

  const loginBlock = block(
    `  Scenario: Registered user logs in with valid credentials`,
    `    Given a registered user exists with email "user@example.com"`,
    `    And the user is on the login page`,
    `    When the user enters valid email and password`,
    `    And the user clicks the "Sign In" button`,
    `    Then the user is authenticated`,
    `    And the user is redirected to the dashboard or home page`,
    ``,
    `  Scenario: Login fails with incorrect password`,
    `    Given a registered user exists with email "user@example.com"`,
    `    And the user is on the login page`,
    `    When the user enters the correct email and an incorrect password`,
    `    And the user clicks the "Sign In" button`,
    `    Then an authentication error message is displayed`,
    `    And the user remains on the login page`,
    ``,
    `  Scenario: Login fails with unregistered email`,
    `    Given the user is on the login page`,
    `    When the user enters an email that is not registered`,
    `    And the user clicks the "Sign In" button`,
    `    Then an error message indicates the account was not found`,
  );

  const signupBlock = hasSignup
    ? block(
        ``,
        `  Scenario: New visitor registers a valid account`,
        `    Given the visitor is on the registration page`,
        `    When the visitor fills in name, a unique email, and a strong password`,
        `    And the visitor submits the registration form`,
        `    Then a new account is created`,
        `    And the visitor receives a confirmation or is redirected to the dashboard`,
        ``,
        `  Scenario: Registration fails when email is already in use`,
        `    Given a registered user exists with email "taken@example.com"`,
        `    And a visitor is on the registration page`,
        `    When the visitor submits the form with email "taken@example.com"`,
        `    Then an error message indicates the email is already registered`,
      )
    : "";

  const logoutBlock = block(
    ``,
    `  Scenario: Authenticated user logs out`,
    `    Given the user is logged in`,
    `    When the user clicks the "Sign Out" or "Logout" button`,
    `    Then the session is invalidated`,
    `    And the user is redirected to the login or home page`,
  );

  return block(`Feature: ${s.title}`, `  # ${s.objective}`, ``, loginBlock, signupBlock, logoutBlock);
}

function gherkinContact(s: Section): string {
  const fields = s.uiElements
    .filter((e) => e.type === "input")
    .map((e) => e.labelOrName)
    .slice(0, 3);

  const fieldList = fields.length > 0 ? fields.join(", ") : "name, email, message";

  return block(
    `Feature: ${s.title}`,
    `  # ${s.objective}`,
    ``,
    `  Scenario: Visitor submits a valid contact form`,
    `    Given the visitor is on the contact page`,
    `    When the visitor fills in all required fields (${fieldList})`,
    `    And the visitor clicks the submit button`,
    `    Then a success confirmation message is displayed`,
    `    And the inquiry is delivered to the site owner`,
    ``,
    `  Scenario: Submission fails when required fields are blank`,
    `    Given the visitor is on the contact page`,
    `    When the visitor clicks the submit button without filling in required fields`,
    `    Then inline validation errors appear for each empty required field`,
    `    And the form is not submitted`,
    ``,
    `  Scenario: Submission fails with an invalid email address`,
    `    Given the visitor is on the contact page`,
    `    When the visitor enters an invalid email address`,
    `    And the visitor clicks the submit button`,
    `    Then an error message indicates the email address is invalid`,
    `    And the form is not submitted`,
    ``,
    `  Scenario: Visitor sees the form in a clean state on page load`,
    `    Given the visitor navigates to the contact page`,
    `    Then the form is empty`,
    `    And no validation errors are displayed`,
  );
}

function gherkinContent(s: Section): string {
  const firstHeading = s.uiElements.find((e) => e.type === "other")?.labelOrName || "article";

  return block(
    `Feature: ${s.title}`,
    `  # ${s.objective}`,
    ``,
    `  Scenario: Visitor views the content listing on page load`,
    `    Given the visitor opens the site`,
    `    Then a list of content items is displayed`,
    `    And each item shows a title and a brief summary or excerpt`,
    ``,
    `  Scenario: Visitor opens a content item for full details`,
    `    Given the visitor is viewing the content listing`,
    `    When the visitor clicks on the "${firstHeading}" item`,
    `    Then the full detail view for that item is displayed`,
    `    And the page title reflects the selected item`,
    ``,
    `  Scenario: Visitor navigates back to the listing from a detail view`,
    `    Given the visitor is on a content detail page`,
    `    When the visitor clicks the back link or browser back button`,
    `    Then the visitor is returned to the content listing`,
    ``,
    `  Scenario: No content items are available`,
    `    Given there are no published content items`,
    `    When the visitor opens the content listing page`,
    `    Then an empty-state message is displayed`,
    `    And the page does not show an error`,
  );
}

function gherkinSearch(s: Section): string {
  return block(
    `Feature: ${s.title}`,
    `  # ${s.objective}`,
    ``,
    `  Scenario: Visitor searches with a matching keyword`,
    `    Given the visitor is on a page with a search field`,
    `    When the visitor types a keyword that matches existing content`,
    `    And the visitor submits the search`,
    `    Then a list of matching results is displayed`,
    `    And each result links to the corresponding content item`,
    ``,
    `  Scenario: Visitor searches with a non-matching keyword`,
    `    Given the visitor is on a page with a search field`,
    `    When the visitor types a keyword that matches no content`,
    `    And the visitor submits the search`,
    `    Then a "no results found" message is displayed`,
    ``,
    `  Scenario: Visitor submits an empty search query`,
    `    Given the visitor is on a page with a search field`,
    `    When the visitor submits the search with an empty field`,
    `    Then an error or prompt message asks the visitor to enter a keyword`,
    `    And no results list is shown`,
    ``,
    `  Scenario: Visitor clicks a search result`,
    `    Given search results are displayed`,
    `    When the visitor clicks on a result`,
    `    Then the visitor is taken to the full detail page for that item`,
  );
}

function gherkinGeneric(s: Section): string {
  const firstWorkflow = s.workflows[0];
  const trigger = firstWorkflow?.trigger ?? "User accesses this feature";
  const steps = firstWorkflow?.steps ?? ["User interacts with the interface"];
  const outcomes = firstWorkflow?.outcomes ?? ["The expected result is shown"];

  const scenarioSteps = [
    `    Given ${trigger.charAt(0).toLowerCase() + trigger.slice(1)}`,
    ...steps.slice(0, 3).map((step) => `    When ${step.charAt(0).toLowerCase() + step.slice(1)}`),
    ...outcomes.map((out) => `    Then ${out.charAt(0).toLowerCase() + out.slice(1)}`),
  ].join("\n");

  return block(
    `Feature: ${s.title}`,
    `  # ${s.objective}`,
    ``,
    `  Scenario: ${firstWorkflow?.name ?? `Use ${s.title}`}`,
    scenarioSteps,
    ``,
    `  Scenario: Feature behaves correctly in an error state`,
    `    Given the user is using the ${s.title} feature`,
    `    When an unexpected error occurs`,
    `    Then an error message is displayed`,
    `    And the user can retry the action`,
  );
}

// ---------------------------------------------------------------------------
// Article section template — maps extracted steps to Given / When / And / Then
// ---------------------------------------------------------------------------

function gherkinArticleSection(s: Section): string {
  const workflow = s.workflows[0];
  const steps = (workflow?.steps ?? []).filter(Boolean);

  if (steps.length === 0) return gherkinGeneric(s);

  const objective = s.objective.slice(0, MAX_OBJECTIVE_LENGTH);
  const lines: string[] = [
    `Feature: ${s.title}`,
    `  # ${objective}`,
    ``,
    `  Scenario: ${workflow?.name ?? s.title}`,
  ];

  if (steps.length === 1) {
    lines.push(`    Given ${steps[0]}`);
  } else if (steps.length === 2) {
    lines.push(`    Given ${steps[0]}`);
    lines.push(`    Then ${steps[1]}`);
  } else {
    lines.push(`    Given ${steps[0]}`);
    for (let i = 1; i < steps.length - 1; i++) {
      lines.push(`    ${i === 1 ? "When" : "And"} ${steps[i]}`);
    }
    lines.push(`    Then ${steps[steps.length - 1]}`);
  }

  return lines.join("\n");
}
