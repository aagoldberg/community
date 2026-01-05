/**
 * Crypto-native lexicon adjusters
 * These work ON TOP of VADER to catch crypto/web3 slang that VADER misses
 * Returns delta values and matched tokens for explainability
 */

// Positive lexicons (crypto/web3 focused - VADER may miss these)
const POSITIVE_STRONG: Record<string, number> = {
  legendary: 0.15,
  goated: 0.15,
  incredible: 0.12,
  phenomenal: 0.12,
  insane: 0.1, // crypto context = very good
};

const POSITIVE_MODERATE: Record<string, number> = {
  bullish: 0.1,
  wagmi: 0.12,
  gm: 0.06,
  gn: 0.04,
  lfg: 0.12,
  based: 0.08,
  dope: 0.08,
  fire: 0.08,
  lit: 0.07,
  goat: 0.1,
  chad: 0.06,
  alpha: 0.05,
  moon: 0.06,
  mooning: 0.08,
  diamond: 0.05,
  ser: 0.03,
  fren: 0.05,
  frens: 0.05,
  anon: 0.02,
  gigabrain: 0.08,
  degen: 0.04, // can be positive in crypto
  wen: 0.02,
  vibes: 0.06,
  banger: 0.08,
  slaps: 0.07,
  hits: 0.05,
  immaculate: 0.1,
};

const POSITIVE_PHRASES: Record<string, number> = {
  "let's go": 0.1,
  "love this": 0.12,
  "love it": 0.12,
  "so good": 0.08,
  "well done": 0.08,
  "great job": 0.08,
  "nice work": 0.07,
  "looking forward": 0.08,
  "can't wait": 0.1,
  "this is it": 0.08,
  "this hits": 0.07,
  "chef's kiss": 0.1,
  "take my money": 0.08,
  "shut up and": 0.06,
  "big if true": 0.05,
  "iykyk": 0.04,
  "good stuff": 0.06,
  "keep building": 0.07,
  "we're early": 0.06,
  "still early": 0.06,
  "never selling": 0.06,
};

// Anger/negative lexicons
const ANGER_STRONG: Record<string, number> = {
  furious: 0.2,
  outraged: 0.2,
  enraged: 0.2,
  livid: 0.2,
  seething: 0.18,
  infuriating: 0.18,
  disgusting: 0.15,
  despicable: 0.18,
  vile: 0.15,
};

const ANGER_MODERATE: Record<string, number> = {
  angry: 0.12,
  pissed: 0.14,
  mad: 0.1,
  annoyed: 0.08,
  irritated: 0.08,
  frustrated: 0.1,
  upset: 0.08,
  disgusted: 0.12,
};

const ANGER_PHRASES: Record<string, number> = {
  "sick of": 0.12,
  "fed up": 0.12,
  "can't stand": 0.14,
  "piss me off": 0.16,
  "pisses me off": 0.16,
  "pissed off": 0.14,
  wtf: 0.1,
  "are you kidding": 0.1,
  "what the hell": 0.12,
  "what the fuck": 0.16,
  "this is insane": 0.08, // context-dependent
  "absolutely ridiculous": 0.14,
  "beyond frustrated": 0.14,
  "so tired of": 0.1,
  "had enough": 0.1,
  "give me a break": 0.08,
  "unbelievable": 0.06, // can be positive or negative
  bullshit: 0.25, // strong anger indicator
  "this is bullshit": 0.3,
};

// Crypto-specific negative
const CRYPTO_NEGATIVE: Record<string, number> = {
  ngmi: 0.12,
  rekt: 0.1,
  rugged: 0.15,
  scam: 0.18,
  scammer: 0.2,
  rug: 0.12,
  rugpull: 0.16,
  ponzi: 0.15,
  grift: 0.14,
  grifter: 0.16,
  exit: 0.05, // exit scam context
  bearish: 0.06,
  dumping: 0.08,
  crashed: 0.1,
  dead: 0.08,
  dying: 0.08,
  over: 0.04, // "it's over"
  joever: 0.1,
  cooked: 0.08,
};

// Negation words
export const NEGATIONS = [
  "not",
  "no",
  "never",
  "n't",
  "without",
  "hardly",
  "rarely",
  "neither",
  "none",
  "nothing",
  "nowhere",
  "nobody",
];

// Intensifiers
export const INTENSIFIERS: Record<string, number> = {
  very: 1.5,
  so: 1.4,
  extremely: 1.6,
  super: 1.5,
  insanely: 1.6,
  crazy: 1.4,
  mega: 1.5,
  hella: 1.5,
  really: 1.4,
  absolutely: 1.5,
  totally: 1.4,
  completely: 1.5,
  utterly: 1.5,
  incredibly: 1.5,
  massively: 1.5,
  ridiculously: 1.4,
  unbelievably: 1.5,
};

// Types for lexicon analysis results
export interface LexiconHits {
  positiveStrong: string[];
  positiveModerate: string[];
  positivePhrases: string[];
  angerStrong: string[];
  angerModerate: string[];
  angerPhrases: string[];
  cryptoNegative: string[];
  negations: string[];
  intensifiers: string[];
}

export interface LexiconDeltas {
  positiveDelta: number; // [0, 0.4]
  angerDelta: number; // [0, 0.6]
  negativeDelta: number; // [0, 0.5]
  hits: LexiconHits;
}

// Tokenize text into words
function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

// Check if word at index has negation in preceding 3 tokens
function hasNegationBefore(words: string[], index: number): boolean {
  for (let i = 1; i <= 3 && index - i >= 0; i++) {
    if (NEGATIONS.includes(words[index - i])) {
      return true;
    }
  }
  return false;
}

// Get intensifier multiplier from preceding 2 tokens
function getIntensifierMultiplier(words: string[], index: number): number {
  for (let i = 1; i <= 2 && index - i >= 0; i++) {
    const mult = INTENSIFIERS[words[index - i]];
    if (mult) return mult;
  }
  return 1.0;
}

// Main lexicon analysis function
export function analyzeLexicon(text: string): LexiconDeltas {
  const lower = text.toLowerCase();
  const words = tokenize(text);

  const hits: LexiconHits = {
    positiveStrong: [],
    positiveModerate: [],
    positivePhrases: [],
    angerStrong: [],
    angerModerate: [],
    angerPhrases: [],
    cryptoNegative: [],
    negations: [],
    intensifiers: [],
  };

  let positiveDelta = 0;
  let angerDelta = 0;
  let negativeDelta = 0;

  // Track found negations and intensifiers
  for (const word of words) {
    if (NEGATIONS.includes(word)) {
      hits.negations.push(word);
    }
    if (INTENSIFIERS[word]) {
      hits.intensifiers.push(word);
    }
  }

  // Check phrases first (before single words)
  for (const [phrase, weight] of Object.entries(POSITIVE_PHRASES)) {
    if (lower.includes(phrase)) {
      hits.positivePhrases.push(phrase);
      // Check for negation before phrase
      const phraseIndex = lower.indexOf(phrase);
      const wordsBeforePhrase = lower.slice(0, phraseIndex).split(/\s+/);
      const lastWords = wordsBeforePhrase.slice(-3);
      const isNegated = lastWords.some((w) => NEGATIONS.includes(w));
      if (isNegated) {
        positiveDelta += weight * 0.25; // Dampen to 25%
      } else {
        positiveDelta += weight;
      }
    }
  }

  for (const [phrase, weight] of Object.entries(ANGER_PHRASES)) {
    if (lower.includes(phrase)) {
      hits.angerPhrases.push(phrase);
      angerDelta += weight;
    }
  }

  // Check single words
  for (let i = 0; i < words.length; i++) {
    const word = words[i];
    const isNegated = hasNegationBefore(words, i);
    const intensifier = getIntensifierMultiplier(words, i);

    // Positive strong
    if (POSITIVE_STRONG[word]) {
      hits.positiveStrong.push(word);
      let delta = POSITIVE_STRONG[word] * intensifier;
      if (isNegated) delta *= 0.25;
      positiveDelta += delta;
    }

    // Positive moderate
    if (POSITIVE_MODERATE[word]) {
      hits.positiveModerate.push(word);
      let delta = POSITIVE_MODERATE[word] * intensifier;
      if (isNegated) delta *= 0.25;
      positiveDelta += delta;
    }

    // Anger strong
    if (ANGER_STRONG[word]) {
      hits.angerStrong.push(word);
      angerDelta += ANGER_STRONG[word] * intensifier;
    }

    // Anger moderate
    if (ANGER_MODERATE[word]) {
      hits.angerModerate.push(word);
      angerDelta += ANGER_MODERATE[word] * intensifier;
    }

    // Crypto negative
    if (CRYPTO_NEGATIVE[word]) {
      hits.cryptoNegative.push(word);
      negativeDelta += CRYPTO_NEGATIVE[word];
    }
  }

  // Cap deltas
  return {
    positiveDelta: Math.min(positiveDelta, 0.4),
    angerDelta: Math.min(angerDelta, 0.6),
    negativeDelta: Math.min(negativeDelta, 0.5),
    hits,
  };
}

// Hope markers (future-oriented positive affect)
const FUTURE_MARKERS = [
  "will",
  "going to",
  "gonna",
  "can't wait",
  "looking forward",
  "next",
  "soon",
  "tomorrow",
  "this week",
  "ship",
  "launch",
  "release",
  "roadmap",
  "upcoming",
  "planning",
  "working on",
];

const HOPE_MARKERS = [
  "excited",
  "bullish",
  "optimistic",
  "hope",
  "hoping",
  "confident",
  "upside",
  "progress",
  "potential",
  "promising",
  "opportunity",
  "possibilities",
  "bright",
  "future",
];

const DESPAIR_MARKERS = [
  "hopeless",
  "over",
  "dead",
  "ngmi",
  "done",
  "give up",
  "giving up",
  "no point",
  "what's the point",
  "joever",
  "it's over",
  "we're cooked",
  "finished",
  "lost cause",
  "doomed",
];

export function analyzeHope(text: string): {
  futureMarkerScore: number;
  hopeMarkerScore: number;
  despairScore: number;
  markers: { future: string[]; hope: string[]; despair: string[] };
} {
  const lower = text.toLowerCase();
  const markers = { future: [] as string[], hope: [] as string[], despair: [] as string[] };

  let futureScore = 0;
  let hopeScore = 0;
  let despairScore = 0;

  for (const marker of FUTURE_MARKERS) {
    if (lower.includes(marker)) {
      markers.future.push(marker);
      futureScore += 0.15;
    }
  }

  for (const marker of HOPE_MARKERS) {
    if (lower.includes(marker)) {
      markers.hope.push(marker);
      hopeScore += 0.2;
    }
  }

  for (const marker of DESPAIR_MARKERS) {
    if (lower.includes(marker)) {
      markers.despair.push(marker);
      despairScore += 0.25;
    }
  }

  return {
    futureMarkerScore: Math.min(futureScore, 1),
    hopeMarkerScore: Math.min(hopeScore, 1),
    despairScore: Math.min(despairScore, 1),
    markers,
  };
}

// Agency markers (action + commitment)
const ACTION_VERBS = [
  "do",
  "build",
  "ship",
  "fix",
  "make",
  "help",
  "join",
  "organize",
  "fund",
  "deploy",
  "launch",
  "start",
  "create",
  "develop",
  "implement",
  "solve",
  "tackle",
  "address",
  "improve",
  "change",
];

const COMMITMENT_PHRASES = [
  "should",
  "let's",
  "lets",
  "we need",
  "i will",
  "i'll",
  "i'm going to",
  "we're going to",
  "we will",
  "we'll",
  "must",
  "have to",
  "need to",
  "gotta",
  "gonna",
  "time to",
  "ready to",
  "about to",
];

// Action signals in replies (for mobilization tracking)
const ACTION_SIGNAL_PATTERNS = [
  /\b(done|shipped|joined|signed up|registered|submitted|completed)\b/i,
  /\bi('ll| will)\s+(do|try|join|sign|check|look)/i,
  /\b(on it|will do|count me in|i'm in|let's go)\b/i,
  /\b(just did|already|finished|made it)\b/i,
];

export function analyzeAgency(text: string): {
  actionMarkerScore: number;
  commitmentScore: number;
  markers: { actions: string[]; commitments: string[] };
} {
  const lower = text.toLowerCase();
  const words = tokenize(text);
  const markers = { actions: [] as string[], commitments: [] as string[] };

  let actionScore = 0;
  let commitmentScore = 0;

  for (const verb of ACTION_VERBS) {
    if (words.includes(verb)) {
      markers.actions.push(verb);
      actionScore += 0.12;
    }
  }

  for (const phrase of COMMITMENT_PHRASES) {
    if (lower.includes(phrase)) {
      markers.commitments.push(phrase);
      commitmentScore += 0.18;
    }
  }

  return {
    actionMarkerScore: Math.min(actionScore, 1),
    commitmentScore: Math.min(commitmentScore, 1),
    markers,
  };
}

export function hasActionSignal(text: string): boolean {
  return ACTION_SIGNAL_PATTERNS.some((pattern) => pattern.test(text));
}

// Sarcasm detection (simple heuristics)
const SARCASM_SIGNALS = [
  /\b(sure|totally|definitely)\b.*\.\.\./i,
  /\b(wow|great|amazing)\b.*\b(not)\b/i,
  /\/s\s*$/,
  /[\u{1F644}\u{1F60F}\u{1F643}]/u, // eye roll, smirk, upside-down face
  /\b(oh|oh wow|oh great|oh yeah)\b.*\.\.\./i,
  /"great"/, // quoted "great"
  /"amazing"/,
  /"wonderful"/,
];

export function detectSarcasm(text: string): boolean {
  return SARCASM_SIGNALS.some((pattern) => pattern.test(text));
}
