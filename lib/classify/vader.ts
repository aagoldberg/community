/**
 * VADER (Valence Aware Dictionary and sEntiment Reasoner) implementation
 * Ported from the Python VADER sentiment analysis tool
 * https://github.com/cjhutto/vaderSentiment
 */

export type VaderScore = {
  compound: number; // [-1, 1] normalized weighted composite score
  pos: number; // [0, 1] proportion of positive sentiment
  neg: number; // [0, 1] proportion of negative sentiment
  neu: number; // [0, 1] proportion of neutral sentiment
};

// Core VADER lexicon with valence scores
// Positive values = positive sentiment, negative values = negative sentiment
// Values range from -4 to +4
const VADER_LEXICON: Record<string, number> = {
  // Strong positive
  "amazing": 3.1,
  "awesome": 3.1,
  "excellent": 3.2,
  "fantastic": 3.0,
  "incredible": 3.0,
  "wonderful": 3.1,
  "brilliant": 2.9,
  "outstanding": 3.0,
  "superb": 2.9,
  "perfect": 3.0,
  "love": 3.2,
  "loved": 3.1,
  "loving": 2.9,
  "beautiful": 2.9,
  "best": 3.0,
  "great": 2.4,
  "good": 1.9,
  "nice": 1.8,
  "happy": 2.7,
  "glad": 2.1,
  "pleased": 2.0,
  "delighted": 2.8,
  "thrilled": 2.9,
  "excited": 2.6,
  "exciting": 2.5,
  "joy": 2.8,
  "joyful": 2.8,
  "fun": 2.3,
  "funny": 2.1,
  "cool": 1.9,
  "helpful": 2.0,
  "kind": 2.1,
  "generous": 2.3,
  "impressive": 2.4,
  "inspired": 2.3,
  "inspiring": 2.4,
  "optimistic": 2.3,
  "positive": 2.0,
  "success": 2.4,
  "successful": 2.3,
  "win": 2.4,
  "winner": 2.3,
  "winning": 2.3,
  "won": 2.3,
  "thank": 1.8,
  "thanks": 1.9,
  "thankful": 2.2,
  "grateful": 2.4,
  "appreciate": 2.1,
  "appreciated": 2.0,

  // Moderate positive
  "like": 1.3,
  "liked": 1.4,
  "enjoy": 1.8,
  "enjoyed": 1.7,
  "enjoying": 1.7,
  "pleasant": 1.8,
  "okay": 0.9,
  "ok": 0.8,
  "fine": 1.0,
  "fair": 0.9,
  "solid": 1.4,
  "decent": 1.2,
  "reasonable": 1.1,
  "interesting": 1.5,
  "useful": 1.6,
  "valuable": 1.7,
  "smart": 1.8,
  "clever": 1.6,

  // Crypto/web3 positive slang
  "bullish": 2.2,
  "wagmi": 2.5,
  "gm": 1.5,
  "gn": 1.3,
  "lfg": 2.4,
  "based": 1.8,
  "dope": 2.0,
  "fire": 2.1,
  "lit": 1.9,
  "goat": 2.6,
  "chad": 1.7,
  "alpha": 1.5,
  "moon": 1.8,
  "mooning": 2.0,
  "pumping": 1.6,
  "diamond": 1.5,
  "rocket": 1.6,

  // Strong negative
  "terrible": -2.9,
  "horrible": -3.0,
  "awful": -2.8,
  "worst": -3.1,
  "hate": -3.2,
  "hated": -3.1,
  "hating": -3.0,
  "disgusting": -2.9,
  "disgusted": -2.8,
  "pathetic": -2.6,
  "stupid": -2.4,
  "idiotic": -2.7,
  "dumb": -2.2,
  "ridiculous": -2.3,
  "absurd": -2.2,
  "outrageous": -2.5,
  "furious": -3.0,
  "enraged": -3.1,
  "infuriating": -2.9,
  "angry": -2.4,
  "mad": -2.1,
  "pissed": -2.5,
  "annoyed": -1.9,
  "annoying": -2.0,
  "irritated": -1.9,
  "irritating": -2.0,
  "frustrated": -2.1,
  "frustrating": -2.2,
  "disappointed": -2.0,
  "disappointing": -2.1,
  "sad": -2.1,
  "depressed": -2.6,
  "depressing": -2.5,
  "miserable": -2.7,
  "painful": -2.2,
  "hurt": -2.0,
  "hurts": -2.0,
  "suffering": -2.4,
  "fail": -2.1,
  "failed": -2.2,
  "failure": -2.4,
  "failing": -2.1,
  "sucks": -2.3,
  "suck": -2.2,
  "bad": -2.1,
  "wrong": -1.8,
  "broken": -1.9,
  "ruined": -2.4,
  "destroyed": -2.5,
  "worthless": -2.6,
  "useless": -2.3,
  "waste": -2.0,
  "wasted": -2.1,

  // Profanity (strong negative)
  "fuck": -3.0,
  "fucking": -3.2,
  "fucked": -3.1,
  "shit": -2.5,
  "shitty": -2.7,
  "bullshit": -2.8,
  "damn": -1.8,
  "damned": -2.0,
  "ass": -1.5,
  "asshole": -2.8,
  "bitch": -2.6,
  "crap": -2.0,
  "crappy": -2.2,
  "hell": -1.6,
  "wtf": -2.2,

  // Crypto/web3 negative slang
  "ngmi": -2.3,
  "rekt": -2.2,
  "rugged": -2.8,
  "scam": -2.9,
  "scammer": -3.0,
  "rug": -2.5,
  "dump": -1.8,
  "dumping": -1.9,
  "bearish": -1.8,
  "crashed": -2.2,
  "crashing": -2.0,
  "dead": -2.0,
  "dying": -2.1,

  // Negation words (handled separately but included for reference)
  "not": 0,
  "no": 0,
  "never": -0.5,
  "nothing": -0.5,
  "none": -0.3,
  "without": -0.2,
};

// Booster words that intensify sentiment
const BOOSTER_DICT: Record<string, number> = {
  "absolutely": 0.293,
  "amazingly": 0.293,
  "awfully": 0.293,
  "completely": 0.293,
  "considerably": 0.293,
  "decidedly": 0.293,
  "deeply": 0.293,
  "enormously": 0.293,
  "entirely": 0.293,
  "especially": 0.293,
  "exceptionally": 0.293,
  "extremely": 0.293,
  "fabulously": 0.293,
  "fully": 0.293,
  "greatly": 0.293,
  "highly": 0.293,
  "hugely": 0.293,
  "incredibly": 0.293,
  "intensely": 0.293,
  "majorly": 0.293,
  "more": 0.293,
  "most": 0.293,
  "particularly": 0.293,
  "purely": 0.293,
  "quite": 0.293,
  "really": 0.293,
  "remarkably": 0.293,
  "so": 0.293,
  "substantially": 0.293,
  "thoroughly": 0.293,
  "totally": 0.293,
  "tremendously": 0.293,
  "uber": 0.293,
  "unbelievably": 0.293,
  "unusually": 0.293,
  "utterly": 0.293,
  "very": 0.293,
  "super": 0.293,
  "insanely": 0.293,
  "crazy": 0.15,
  "mega": 0.293,
  "hella": 0.293,

  // Dampeners
  "almost": -0.293,
  "barely": -0.293,
  "hardly": -0.293,
  "just": -0.293,
  "kind of": -0.293,
  "kinda": -0.293,
  "kindof": -0.293,
  "less": -0.293,
  "little": -0.293,
  "marginally": -0.293,
  "occasionally": -0.293,
  "partly": -0.293,
  "scarcely": -0.293,
  "slightly": -0.293,
  "somewhat": -0.293,
  "sort of": -0.293,
  "sorta": -0.293,
  "sortof": -0.293,
};

// Negation words
const NEGATIONS = new Set([
  "not",
  "no",
  "never",
  "neither",
  "nobody",
  "nothing",
  "nowhere",
  "none",
  "without",
  "hardly",
  "rarely",
  "seldom",
  "scarcely",
  "n't",
  "isn't",
  "aren't",
  "wasn't",
  "weren't",
  "won't",
  "wouldn't",
  "couldn't",
  "shouldn't",
  "doesn't",
  "don't",
  "didn't",
  "hasn't",
  "haven't",
  "hadn't",
  "can't",
  "cannot",
]);

// Constants for scoring
const B_INCR = 0.293;
const B_DECR = -0.293;
const C_INCR = 0.733;
const N_SCALAR = -0.74;

// Check for negation in preceding words
function negationCheck(word: string): boolean {
  return NEGATIONS.has(word.toLowerCase());
}

// Normalize score to be between -1 and 1
function normalizeScore(score: number, alpha: number = 15): number {
  const normScore = score / Math.sqrt(score * score + alpha);
  return Math.max(-1, Math.min(1, normScore));
}

// Tokenize text into words
function tokenize(text: string): string[] {
  // Simple tokenization - split on whitespace and punctuation
  return text
    .toLowerCase()
    .replace(/[^\w\s']/g, " ")
    .split(/\s+/)
    .filter((w) => w.length > 0);
}

// Check if word is ALL CAPS (emphasis)
function isAllCaps(word: string): boolean {
  return word === word.toUpperCase() && word !== word.toLowerCase();
}

// Get valence for a word considering context
function getValence(
  word: string,
  words: string[],
  index: number
): number {
  const lowerWord = word.toLowerCase();
  let valence = VADER_LEXICON[lowerWord] ?? 0;

  if (valence === 0) return 0;

  // Check for ALL CAPS emphasis
  if (isAllCaps(word) && word.length > 1) {
    if (valence > 0) {
      valence += C_INCR;
    } else {
      valence -= C_INCR;
    }
  }

  // Check for boosters/dampeners in preceding 3 words
  for (let i = 1; i <= 3 && index - i >= 0; i++) {
    const precedingWord = words[index - i].toLowerCase();
    const boostValue = BOOSTER_DICT[precedingWord];

    if (boostValue !== undefined) {
      // Apply booster with decay based on distance
      const dampFactor = 1 - 0.15 * i;
      if (valence > 0) {
        valence += boostValue * dampFactor;
      } else {
        valence -= boostValue * dampFactor;
      }
    }

    // Check for negation
    if (negationCheck(precedingWord)) {
      valence *= N_SCALAR;
      break; // Only apply one negation
    }
  }

  return valence;
}

// Compute VADER sentiment scores
export function computeVader(text: string): VaderScore {
  const words = tokenize(text);

  if (words.length === 0) {
    return { compound: 0, pos: 0, neg: 0, neu: 1 };
  }

  const sentiments: number[] = [];

  for (let i = 0; i < words.length; i++) {
    const valence = getValence(words[i], words, i);
    if (valence !== 0) {
      sentiments.push(valence);
    }
  }

  if (sentiments.length === 0) {
    return { compound: 0, pos: 0, neg: 0, neu: 1 };
  }

  // Sum up sentiments
  let sumS = sentiments.reduce((a, b) => a + b, 0);

  // Check for punctuation emphasis (! increases magnitude)
  const exclamationCount = (text.match(/!/g) || []).length;
  if (exclamationCount > 0) {
    const epAmplifier = Math.min(exclamationCount, 4) * 0.292;
    if (sumS > 0) {
      sumS += epAmplifier;
    } else if (sumS < 0) {
      sumS -= epAmplifier;
    }
  }

  // Question marks can reduce certainty of positive sentiment
  const questionCount = (text.match(/\?/g) || []).length;
  if (questionCount > 0 && sumS > 0) {
    sumS -= questionCount * 0.18;
  }

  // Compute compound score
  const compound = normalizeScore(sumS);

  // Compute pos/neg/neu proportions
  let posSum = 0;
  let negSum = 0;

  for (const s of sentiments) {
    if (s > 0) {
      posSum += s + 1; // Add 1 to avoid 0 counts
    } else if (s < 0) {
      negSum += Math.abs(s) + 1;
    }
  }

  const total = posSum + negSum + sentiments.length;

  const pos = Math.round((posSum / total) * 1000) / 1000;
  const neg = Math.round((negSum / total) * 1000) / 1000;
  const neu = Math.round((1 - (pos + neg)) * 1000) / 1000;

  return {
    compound: Math.round(compound * 1000) / 1000,
    pos: Math.max(0, pos),
    neg: Math.max(0, neg),
    neu: Math.max(0, neu),
  };
}

// Export constants for use in other modules
export { NEGATIONS, BOOSTER_DICT, VADER_LEXICON };
