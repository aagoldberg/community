/**
 * Hybrid emotion scoring system
 * Combines VADER baseline + crypto-native lexicon adjusters
 * Produces: sentiment, positivity, negativity, anger, hope, agency, confidence
 */

import { computeVader, VaderScore } from "./vader";
import {
  analyzeLexicon,
  analyzeHope,
  analyzeAgency,
  detectSarcasm,
  LexiconHits,
} from "./lexicon";

export type { VaderScore };

export interface MessageEmotion {
  // Core scores (all 0-1 except sentiment which is -1 to 1)
  sentiment: number; // [-1, 1] final composite sentiment
  positivity: number; // [0, 1]
  negativity: number; // [0, 1]
  anger: number; // [0, 1]
  hope: number; // [0, 1]
  agency: number; // [0, 1]
  confidence: number; // [0, 1] heuristic for reliability

  // Explainability
  explain: {
    vader: VaderScore;
    lexiconHits: LexiconHits;
    hopeMarkers: { future: string[]; hope: string[]; despair: string[] };
    agencyMarkers: { actions: string[]; commitments: string[] };
    rulesTriggered: string[];
  };
}

// Clamp value between min and max
function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

// Round to 3 decimal places
function round3(value: number): number {
  return Math.round(value * 1000) / 1000;
}

/**
 * Compute full emotion scores for a single message
 */
export function computeEmotion(text: string): MessageEmotion {
  const rulesTriggered: string[] = [];

  // 1. Get VADER baseline
  const vader = computeVader(text);

  // 2. Get lexicon adjustments
  const lexicon = analyzeLexicon(text);

  // 3. Get hope analysis
  const hopeAnalysis = analyzeHope(text);

  // 4. Get agency analysis
  const agencyAnalysis = analyzeAgency(text);

  // 5. Check for sarcasm
  const isSarcastic = detectSarcasm(text);
  if (isSarcastic) {
    rulesTriggered.push("sarcasm_detected");
  }

  // --- Compute final scores ---

  // Sentiment formula: 0.6 * vader.compound + 0.4 * lexiconSignedScore
  // lexiconSignedScore = positiveDelta - angerDelta - negativeDelta
  const lexiconSignedScore =
    lexicon.positiveDelta - lexicon.angerDelta - lexicon.negativeDelta;

  let sentiment = 0.6 * vader.compound + 0.4 * lexiconSignedScore;

  // Apply sarcasm dampening
  if (isSarcastic && sentiment > 0) {
    sentiment *= 0.3; // Heavily dampen positive sentiment if sarcastic
    rulesTriggered.push("sarcasm_dampened_positive");
  }

  sentiment = clamp(sentiment, -1, 1);

  // Positivity: vader.pos + positiveDelta
  let positivity = vader.pos + lexicon.positiveDelta;
  if (isSarcastic) {
    positivity *= 0.5;
    rulesTriggered.push("sarcasm_dampened_positivity");
  }
  positivity = clamp(positivity, 0, 1);

  // Negativity: vader.neg + negativeDelta + angerDelta * 0.5
  const negativity = clamp(
    vader.neg + lexicon.negativeDelta + lexicon.angerDelta * 0.5,
    0,
    1
  );

  // Anger: angerDelta + angerFromVaderProxy
  // angerFromVaderProxy = max(0, -vader.compound) * 0.2
  const angerFromVaderProxy = Math.max(0, -vader.compound) * 0.2;
  const anger = clamp(lexicon.angerDelta + angerFromVaderProxy, 0, 1);

  if (anger > 0.3) {
    rulesTriggered.push("anger_detected");
  }

  // Hope formula: positivity + futureMarkers + hopeMarkers - despair
  // Boosted weights for future-oriented language
  const hopeRaw =
    0.3 * positivity +
    0.5 * hopeAnalysis.futureMarkerScore +
    0.4 * hopeAnalysis.hopeMarkerScore -
    0.6 * hopeAnalysis.despairScore;

  const hope = clamp(hopeRaw, 0, 1);

  if (hopeAnalysis.markers.future.length > 0) {
    rulesTriggered.push("future_markers_found");
  }
  if (hopeAnalysis.markers.despair.length > 0) {
    rulesTriggered.push("despair_markers_found");
  }

  // Agency formula: actionMarkers + commitment + emotional intensity
  // Agency is high when action/commitment markers present, boosted by emotion
  const emotionalIntensity = Math.max(positivity, anger);
  const agencyRaw =
    0.5 * agencyAnalysis.actionMarkerScore +
    0.5 * agencyAnalysis.commitmentScore +
    0.2 * emotionalIntensity;

  // Boost agency if both action and emotion are present
  let agency = agencyRaw;
  if (agencyAnalysis.actionMarkerScore > 0.1 && emotionalIntensity > 0.2) {
    agency *= 1.3;
    rulesTriggered.push("action_emotion_boost");
  }
  // Additional boost for commitment presence
  if (agencyAnalysis.commitmentScore > 0.1) {
    agency = Math.max(agency, 0.25); // minimum agency when commitment detected
  }
  agency = clamp(agency, 0, 1);

  if (agencyAnalysis.markers.commitments.length > 0) {
    rulesTriggered.push("commitment_detected");
  }

  // Confidence heuristic
  let confidence = 0.5; // baseline

  // Higher when text is longer
  if (text.length >= 50) {
    confidence += 0.2;
    rulesTriggered.push("longer_text_boost");
  } else if (text.length >= 20) {
    confidence += 0.1;
  } else if (text.length < 10) {
    confidence -= 0.2;
    rulesTriggered.push("short_text_penalty");
  }

  // Higher when multiple signals agree
  const vaderSentimentSign = Math.sign(vader.compound);
  const lexiconSentimentSign = Math.sign(lexiconSignedScore);
  if (
    vaderSentimentSign !== 0 &&
    vaderSentimentSign === lexiconSentimentSign
  ) {
    confidence += 0.15;
    rulesTriggered.push("signals_agree");
  }

  // Lower when only slang detected (VADER weak but lexicon strong)
  if (
    Math.abs(vader.compound) < 0.1 &&
    Math.abs(lexiconSignedScore) > 0.15
  ) {
    confidence -= 0.1;
    rulesTriggered.push("slang_only_penalty");
  }

  // Lower for sarcasm
  if (isSarcastic) {
    confidence -= 0.2;
  }

  confidence = clamp(confidence, 0, 1);

  return {
    sentiment: round3(sentiment),
    positivity: round3(positivity),
    negativity: round3(negativity),
    anger: round3(anger),
    hope: round3(hope),
    agency: round3(agency),
    confidence: round3(confidence),
    explain: {
      vader,
      lexiconHits: lexicon.hits,
      hopeMarkers: hopeAnalysis.markers,
      agencyMarkers: agencyAnalysis.markers,
      rulesTriggered,
    },
  };
}

/**
 * Batch compute emotions for multiple messages
 */
export function computeEmotionBatch(
  texts: string[]
): Map<number, MessageEmotion> {
  const results = new Map<number, MessageEmotion>();

  for (let i = 0; i < texts.length; i++) {
    results.set(i, computeEmotion(texts[i]));
  }

  return results;
}

/**
 * Simplified classification for backward compatibility
 */
export interface Classification {
  sentiment: "positive" | "negative" | "neutral";
  hasAnger: boolean;
  angerConfidence: number;
  hasAgency: boolean;
}

export function emotionToClassification(emotion: MessageEmotion): Classification {
  let sentiment: "positive" | "negative" | "neutral" = "neutral";

  if (emotion.sentiment > 0.15) {
    sentiment = "positive";
  } else if (emotion.sentiment < -0.15) {
    sentiment = "negative";
  }

  return {
    sentiment,
    hasAnger: emotion.anger >= 0.3,
    angerConfidence: emotion.anger,
    hasAgency: emotion.agency >= 0.3,
  };
}
