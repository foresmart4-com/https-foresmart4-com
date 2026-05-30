// Question Binding Governor
// Analyzes question intent and generates a binding directive forcing the response
// to answer exactly what was asked.
//
// Root cause addressed: Question intent not fully binding response architecture.
// When a user asks for CIO framing, allocator view, historical analog, or thesis,
// the response MUST contain them — their absence is a compliance failure.
//
// This governor:
//   1. Classifies the question into required institutional sections
//   2. Generates a binding directive injected into the prompt
//   3. Returns a validation checklist for post-response architecture audit
//
// No AI calls. No network. Pure deterministic. O(1).

export interface BoundSection {
  name: string;           // e.g. "historical_analog"
  fieldRequired: string;  // e.g. "voiceReasoning.historical"
  humanLabel: string;     // e.g. "Historical Analog"
}

export interface QuestionBindingResult {
  boundSections: BoundSection[];
  bindingDirective: string;     // inject at end of prompt
  questionIntent: string;       // classified intent label
  hasMandatoryOutput: boolean;  // true when at least 1 bound section detected
}

// Intent patterns — English + Arabic
const INTENT_PATTERNS: Array<{
  name: string;
  fieldRequired: string;
  humanLabel: string;
  patterns: RegExp[];
}> = [
  {
    name: "historical_analog",
    fieldRequired: "voiceReasoning.historical",
    humanLabel: "Historical Analog",
    patterns: [
      /historical|analog|precedent|similar period|like \d{4}|نظير|تاريخي|مشابه|سابق|دورة سابقة/i,
      /what happened|how.*resolved|previous cycle|الدورة السابقة|ما حدث/i,
    ],
  },
  {
    name: "thesis",
    fieldRequired: "thesis",
    humanLabel: "Investment Thesis",
    patterns: [
      /\bthesis\b|base case|investment case|أطروحة|الحالة الأساسية/i,
    ],
  },
  {
    name: "counter_thesis",
    fieldRequired: "opposingCase",
    humanLabel: "Counter-Thesis",
    patterns: [
      /\bcounter\b|opposing|bear case|downside case|الحالة الهابطة|السيناريو السلبي/i,
    ],
  },
  {
    name: "allocator_view",
    fieldRequired: "voiceReasoning.allocator",
    humanLabel: "Allocator View",
    patterns: [
      /allocator|portfolio.*allocat|deploy capital|should.*invest|ينشر.*رأس المال|مخصص/i,
    ],
  },
  {
    name: "cio_framing",
    fieldRequired: "committeeSynthesis.finalStance",
    humanLabel: "CIO Framing",
    patterns: [
      /\bcio\b|chief investment|as.*cio|from.*cio|من.*منظور.*كبير|من.*وجهة.*كبير المستثمرين|رأي.*كبير/i,
    ],
  },
  {
    name: "macro_chain",
    fieldRequired: "macroChain",
    humanLabel: "Macro Transmission Chain",
    patterns: [
      /macro|transmission|channel|mechanism|chain|قناة.*انتقال|سلسلة.*ماكرو/i,
    ],
  },
  {
    name: "direct_answer",
    fieldRequired: "baseCase",
    humanLabel: "Direct Answer",
    patterns: [
      /what.*outlook|what.*view|should.*invest|where.*going|ما.*التوقع|ما.*الموقف|هل يجب|ما الرأي/i,
    ],
  },
];

function detectBoundSections(question: string): BoundSection[] {
  const bound: BoundSection[] = [];
  for (const intent of INTENT_PATTERNS) {
    if (intent.patterns.some(re => re.test(question))) {
      bound.push({
        name: intent.name,
        fieldRequired: intent.fieldRequired,
        humanLabel: intent.humanLabel,
      });
    }
  }
  // Always require direct_answer for any investment question
  if (!bound.some(b => b.name === "direct_answer")) {
    bound.push({
      name: "direct_answer",
      fieldRequired: "baseCase",
      humanLabel: "Direct Answer",
    });
  }
  return bound;
}

function buildBindingDirective(sections: BoundSection[], lang: "ar" | "en"): string {
  if (sections.length === 0) return "";
  const labels = sections.map(s => s.humanLabel).join(", ");
  if (lang === "ar") {
    return `[QUESTION BINDING] الأقسام التالية إلزامية لهذا السؤال — يجب أن تتضمن الإجابة صراحةً: ${labels}. غياب أي منها يُعدّ فشلاً في الامتثال للسؤال.`;
  }
  return `[QUESTION BINDING] The following sections are MANDATORY for this question — the answer MUST explicitly contain: ${labels}. Missing any = question compliance failure.`;
}

function classifyIntent(sections: BoundSection[]): string {
  const names = sections.map(s => s.name);
  if (names.includes("cio_framing") && names.includes("allocator_view")) return "cio_institutional";
  if (names.includes("historical_analog")) return "historical_query";
  if (names.includes("thesis") && names.includes("counter_thesis")) return "thesis_debate";
  if (names.includes("allocator_view")) return "allocator_query";
  if (names.includes("macro_chain")) return "macro_query";
  return "investment_general";
}

export function buildQuestionBinding(question: string, lang: "ar" | "en"): QuestionBindingResult {
  const boundSections = detectBoundSections(question);
  const bindingDirective = buildBindingDirective(boundSections, lang);
  const questionIntent = classifyIntent(boundSections);
  return {
    boundSections,
    bindingDirective,
    questionIntent,
    hasMandatoryOutput: boundSections.length > 0,
  };
}
