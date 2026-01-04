// High-precision anger lexicon
const ANGER_STRONG = [
  "furious",
  "outraged",
  "disgusted",
  "hate",
  "despise",
  "enraged",
  "infuriating",
  "unacceptable",
  "bullshit",
  "fucking",
  "pathetic",
  "ridiculous",
  "absurd",
  "idiotic",
  "stupid",
];

const ANGER_MODERATE = [
  "angry",
  "annoyed",
  "frustrated",
  "pissed",
  "mad",
  "irritated",
  "upset",
  "disgusting",
  "terrible",
  "awful",
  "horrible",
];

const ANGER_PHRASES = [
  "sick of",
  "fed up",
  "can't stand",
  "piss me off",
  "pisses me off",
  "wtf",
  "are you kidding",
  "what the hell",
  "what the fuck",
  "this is insane",
  "absolutely ridiculous",
  "beyond frustrated",
  "so tired of",
  "had enough",
];

// Agency patterns (calls-to-action, commitments)
const AGENCY_PATTERNS = [
  /\b(i('m| am) going to|i('ll| will)|let's|we should|join (me|us))\b/i,
  /\b(help (me|us)|sign up|donate|vote|register|ship)\b/i,
  /\b(commit(ted)?|pledg(e|ing)|promise|dedicated)\b/i,
  /\b(who wants|anyone interested|who's in|count me in)\b/i,
  /\b(take action|make a difference|get involved)\b/i,
  /\b(launching|shipping|releasing|announcing)\b/i,
];

// Action signals in replies (for mobilization tracking)
const ACTION_SIGNAL_PATTERNS = [
  /\b(done|shipped|joined|signed up|registered|submitted|completed)\b/i,
  /\bi('ll| will)\s+(do|try|join|sign|check|look)/i,
  /\b(on it|will do|count me in|i'm in|let's go)\b/i,
  /\b(just did|already|finished|made it)\b/i,
];

export interface LexiconResult {
  angerScore: number;
  angerConfidence: "high" | "medium" | "low";
  hasAgency: boolean;
  agencyConfidence: "high" | "medium" | "low";
}

export function analyzeLexicon(text: string): LexiconResult {
  const lower = text.toLowerCase();

  // Anger detection
  let angerScore = 0;
  let angerMatches = 0;

  for (const word of ANGER_STRONG) {
    if (lower.includes(word)) {
      angerScore += 0.4;
      angerMatches++;
    }
  }

  for (const word of ANGER_MODERATE) {
    if (lower.includes(word)) {
      angerScore += 0.25;
      angerMatches++;
    }
  }

  for (const phrase of ANGER_PHRASES) {
    if (lower.includes(phrase)) {
      angerScore += 0.35;
      angerMatches++;
    }
  }

  // Cap at 1.0
  angerScore = Math.min(angerScore, 1.0);

  // Confidence based on number and strength of matches
  let angerConfidence: "high" | "medium" | "low" = "low";
  if (angerScore >= 0.7 || angerMatches >= 2) {
    angerConfidence = "high";
  } else if (angerScore >= 0.3) {
    angerConfidence = "medium";
  }

  // Agency detection
  let agencyMatches = 0;
  for (const pattern of AGENCY_PATTERNS) {
    if (pattern.test(text)) {
      agencyMatches++;
    }
  }

  const hasAgency = agencyMatches > 0;
  let agencyConfidence: "high" | "medium" | "low" = "low";
  if (agencyMatches >= 2) {
    agencyConfidence = "high";
  } else if (agencyMatches === 1) {
    agencyConfidence = "medium";
  }

  return {
    angerScore,
    angerConfidence,
    hasAgency,
    agencyConfidence,
  };
}

export function hasActionSignal(text: string): boolean {
  return ACTION_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

// Detect if text might be sarcastic (reduces confidence)
const SARCASM_SIGNALS = [
  /\b(sure|totally|definitely)\b.*\.\.\./i,
  /\b(wow|great|amazing)\b.*\b(not)\b/i,
  /\/s\s*$/,
  /[\u{1F644}\u{1F60F}\u{1F643}]/u, // eye roll, smirk, upside-down face
];

export function maybeSarcastic(text: string): boolean {
  return SARCASM_SIGNALS.some((pattern) => pattern.test(text));
}
