export interface UIElement {
  type: "button" | "input" | "form" | "link" | "modal" | "table" | "card" | "nav" | "other";
  labelOrName: string;
  selectorHint?: string;
  purpose: string;
}

export interface Workflow {
  name: string;
  actors: string[];
  trigger: string;
  steps: string[];
  outcomes: string[];
  edgeCases?: string[];
}

export interface RebuildStep {
  order: number;
  instruction: string;
  technicalHint?: string;
}

export interface Section {
  id: string;
  title: string;
  objective: string;
  priority: "high" | "medium" | "low";
  uiElements: UIElement[];
  workflows: Workflow[];
  dependencies: string[];
  acceptanceCriteria: string[];
  rebuildProcedure: RebuildStep[];
  gherkin: string;
}

export interface AnalysisResult {
  url: string;
  analyzedAt: string;
  siteSummary: string;
  sections: Section[];
}

export interface AnalyzeRequest {
  url: string;
}

export interface AnalyzeErrorResponse {
  error: string;
}
