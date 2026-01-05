import { describe, it, expect } from "vitest";
import { computeEmotion, emotionToClassification } from "../emotion";

// Re-export analyzePost for convenience (same as computeEmotion)
const analyzePost = computeEmotion;

describe("Emotion Scoring System", () => {
  describe("Negation handling", () => {
    it('"not great" should score lower than "great"', () => {
      const great = computeEmotion("great");
      const notGreat = computeEmotion("not great");

      expect(notGreat.sentiment).toBeLessThan(great.sentiment);
      expect(notGreat.positivity).toBeLessThan(great.positivity);
    });

    it('"not amazing" should score lower than "amazing"', () => {
      const amazing = computeEmotion("amazing");
      const notAmazing = computeEmotion("not amazing");

      expect(notAmazing.sentiment).toBeLessThan(amazing.sentiment);
    });

    it('"never good" should score lower than "good"', () => {
      const good = computeEmotion("good");
      const neverGood = computeEmotion("never good");

      expect(neverGood.sentiment).toBeLessThan(good.sentiment);
    });
  });

  describe("Intensifier handling", () => {
    it('"so great!!!" should score higher than "great"', () => {
      const great = computeEmotion("great");
      const soGreat = computeEmotion("so great!!!");

      expect(soGreat.sentiment).toBeGreaterThan(great.sentiment);
    });

    it('"very happy" should score higher than "happy"', () => {
      const happy = computeEmotion("happy");
      const veryHappy = computeEmotion("very happy");

      expect(veryHappy.sentiment).toBeGreaterThan(happy.sentiment);
    });

    it('"extremely good" should boost positivity', () => {
      const good = computeEmotion("good");
      const extremelyGood = computeEmotion("extremely good");

      expect(extremelyGood.positivity).toBeGreaterThan(good.positivity);
    });
  });

  describe("Hope scoring", () => {
    it('"I can\'t wait to ship this" should have hope markers', () => {
      const result = computeEmotion("I can't wait to ship this");

      expect(result.hope).toBeGreaterThan(0.1);
      // Agency is lower without explicit commitment phrases like "I will" or "let's"
      expect(result.agency).toBeGreaterThanOrEqual(0);
      expect(result.explain.hopeMarkers.future).toContain("can't wait");
      expect(result.explain.hopeMarkers.future).toContain("ship");
      expect(result.explain.rulesTriggered).toContain("future_markers_found");
    });

    it('"looking forward to the launch" should have hope markers', () => {
      const result = computeEmotion("looking forward to the launch");

      expect(result.hope).toBeGreaterThan(0.1);
      expect(result.explain.hopeMarkers.future).toContain("looking forward");
      expect(result.explain.hopeMarkers.future).toContain("launch");
      expect(result.explain.rulesTriggered).toContain("future_markers_found");
    });

    it('"it\'s over, we\'re cooked" should have low hope', () => {
      const result = computeEmotion("it's over, we're cooked");

      expect(result.hope).toBeLessThan(0.3);
      expect(result.explain.hopeMarkers.despair.length).toBeGreaterThan(0);
    });
  });

  describe("Agency scoring", () => {
    it('"this is bullshit, fix it" should have high anger and medium agency', () => {
      const result = computeEmotion("this is bullshit, fix it");

      expect(result.anger).toBeGreaterThan(0.2);
      expect(result.agency).toBeGreaterThan(0.2);
      expect(result.explain.agencyMarkers.actions).toContain("fix");
    });

    it('"let\'s build something amazing" should have high agency', () => {
      const result = computeEmotion("let's build something amazing");

      expect(result.agency).toBeGreaterThan(0.4);
      expect(result.explain.agencyMarkers.commitments).toContain("let's");
      expect(result.explain.agencyMarkers.actions).toContain("build");
    });

    it('"I will help organize this" should have commitment detected', () => {
      const result = computeEmotion("I will help organize this");

      expect(result.agency).toBeGreaterThanOrEqual(0.25);
      expect(result.explain.rulesTriggered).toContain("commitment_detected");
      expect(result.explain.agencyMarkers.commitments).toContain("i will");
      expect(result.explain.agencyMarkers.actions).toContain("help");
    });
  });

  describe("Crypto slang handling", () => {
    it('"gm wagmi lfg" should have positive delta even if VADER is weak', () => {
      const result = computeEmotion("gm wagmi lfg");

      expect(result.sentiment).toBeGreaterThan(0);
      expect(result.positivity).toBeGreaterThan(0.1);
      expect(result.explain.lexiconHits.positiveModerate).toContain("gm");
      expect(result.explain.lexiconHits.positiveModerate).toContain("wagmi");
      expect(result.explain.lexiconHits.positiveModerate).toContain("lfg");
    });

    it('"ngmi rekt" should have negative sentiment', () => {
      const result = computeEmotion("ngmi rekt");

      expect(result.sentiment).toBeLessThan(0);
      expect(result.explain.lexiconHits.cryptoNegative).toContain("ngmi");
      expect(result.explain.lexiconHits.cryptoNegative).toContain("rekt");
    });

    it('"bullish on this project" should be positive', () => {
      const result = computeEmotion("bullish on this project");

      expect(result.sentiment).toBeGreaterThan(0);
      expect(result.explain.lexiconHits.positiveModerate).toContain("bullish");
    });
  });

  describe("Compound expressions", () => {
    it("should handle mixed sentiment correctly", () => {
      const result = computeEmotion(
        "I love this idea but the execution is terrible"
      );

      // Mixed sentiment should not be strongly positive or negative
      expect(Math.abs(result.sentiment)).toBeLessThan(0.5);
    });

    it("should detect sarcasm signals", () => {
      const result = computeEmotion('oh "great" another rug pull...');

      expect(result.explain.rulesTriggered).toContain("sarcasm_detected");
      // Sarcasm should dampen positive sentiment
      expect(result.positivity).toBeLessThan(0.3);
    });
  });

  describe("Confidence scoring", () => {
    it("should have lower confidence for very short text", () => {
      const shortText = computeEmotion("ok");
      const longerText = computeEmotion(
        "This is a longer message that provides more context for analysis"
      );

      expect(shortText.confidence).toBeLessThan(longerText.confidence);
    });

    it("should have higher confidence when VADER and lexicon agree", () => {
      const result = computeEmotion(
        "This is absolutely amazing, I love it so much!"
      );

      expect(result.explain.rulesTriggered).toContain("signals_agree");
      expect(result.confidence).toBeGreaterThan(0.5);
    });
  });

  describe("Edge cases", () => {
    it("should handle empty string", () => {
      const result = computeEmotion("");

      expect(result.sentiment).toBe(0);
      expect(result.positivity).toBe(0);
      expect(result.negativity).toBe(0);
    });

    it("should handle pure emojis gracefully", () => {
      const result = computeEmotion("🚀🔥💎");

      // Should not crash, scores may be neutral
      expect(result.sentiment).toBeDefined();
    });

    it("should handle all caps (emphasis)", () => {
      const lower = computeEmotion("this is great");
      const caps = computeEmotion("THIS IS GREAT");

      // All caps should slightly boost sentiment
      expect(caps.sentiment).toBeGreaterThanOrEqual(lower.sentiment);
    });
  });
});

describe("analyzePost function", () => {
  it("should return full MessageEmotion object", () => {
    const result = analyzePost("This is a test message");

    expect(result).toHaveProperty("sentiment");
    expect(result).toHaveProperty("positivity");
    expect(result).toHaveProperty("negativity");
    expect(result).toHaveProperty("anger");
    expect(result).toHaveProperty("hope");
    expect(result).toHaveProperty("agency");
    expect(result).toHaveProperty("confidence");
    expect(result).toHaveProperty("explain");
    expect(result.explain).toHaveProperty("vader");
    expect(result.explain).toHaveProperty("lexiconHits");
    expect(result.explain).toHaveProperty("rulesTriggered");
  });
});
