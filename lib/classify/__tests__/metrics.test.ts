import { describe, it, expect } from "vitest";
import {
  computeCommunityMetrics,
  computeMetricsForWindow,
  computeDailyMetrics,
  TimestampedEmotion,
} from "../metrics";
import { MessageEmotion } from "../emotion";

// Helper to create a mock emotion
function mockEmotion(overrides: Partial<MessageEmotion> = {}): MessageEmotion {
  return {
    sentiment: 0,
    positivity: 0.3,
    negativity: 0.1,
    anger: 0.1,
    hope: 0.3,
    agency: 0.2,
    confidence: 0.5,
    explain: {
      vader: { compound: 0, pos: 0.3, neg: 0.1, neu: 0.6 },
      lexiconHits: {
        positiveStrong: [],
        positiveModerate: [],
        positivePhrases: [],
        angerStrong: [],
        angerModerate: [],
        angerPhrases: [],
        cryptoNegative: [],
        negations: [],
        intensifiers: [],
      },
      hopeMarkers: { future: [], hope: [], despair: [] },
      agencyMarkers: { actions: [], commitments: [] },
      rulesTriggered: [],
    },
    ...overrides,
  };
}

describe("Community Metrics", () => {
  describe("computeCommunityMetrics", () => {
    it("should handle empty array", () => {
      const metrics = computeCommunityMetrics([]);

      expect(metrics.totalMessages).toBe(0);
      expect(metrics.rageDensity).toBe(0);
      expect(metrics.hopeIndex).toBe(0);
    });

    it("should compute correct averages", () => {
      const emotions = [
        mockEmotion({ sentiment: 0.5, positivity: 0.6 }),
        mockEmotion({ sentiment: -0.5, positivity: 0.2 }),
      ];

      const metrics = computeCommunityMetrics(emotions);

      expect(metrics.avgSentiment).toBe(0);
      expect(metrics.avgPositivity).toBe(0.4);
      expect(metrics.totalMessages).toBe(2);
    });

    it("should compute rage density correctly", () => {
      const emotions = [
        mockEmotion({ anger: 0.7 }), // high anger
        mockEmotion({ anger: 0.8 }), // high anger
        mockEmotion({ anger: 0.3 }), // low anger
        mockEmotion({ anger: 0.2 }), // low anger
      ];

      const metrics = computeCommunityMetrics(emotions);

      // 2 out of 4 messages have anger > 0.6 = 500 per 1000
      expect(metrics.rageDensity).toBe(500);
    });

    it("should compute hope metrics correctly", () => {
      const emotions = [
        mockEmotion({ hope: 0.8 }), // high hope
        mockEmotion({ hope: 0.9 }), // high hope
        mockEmotion({ hope: 0.3 }), // low hope
        mockEmotion({ hope: 0.4 }), // low hope
      ];

      const metrics = computeCommunityMetrics(emotions);

      expect(metrics.hopeIndex).toBe(0.6); // average
      expect(metrics.hopeHighPct).toBe(50); // 2 out of 4 >= 0.7
    });

    it("should compute agency rate correctly", () => {
      const emotions = [
        // Emotional (pos >= 0.4) with high agency
        mockEmotion({ positivity: 0.5, anger: 0.1, agency: 0.7 }),
        // Emotional (anger >= 0.4) with high agency
        mockEmotion({ positivity: 0.1, anger: 0.5, agency: 0.8 }),
        // Emotional but low agency
        mockEmotion({ positivity: 0.6, anger: 0.1, agency: 0.3 }),
        // Not emotional
        mockEmotion({ positivity: 0.2, anger: 0.1, agency: 0.9 }),
      ];

      const metrics = computeCommunityMetrics(emotions);

      // 3 emotional messages, 2 have agency >= 0.6
      expect(metrics.agencyRate).toBeCloseTo(66.67, 0);
    });
  });

  describe("computeMetricsForWindow", () => {
    it("should filter emotions by time window", () => {
      const now = new Date();
      const sevenDaysAgo = new Date(now);
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

      const tenDaysAgo = new Date(now);
      tenDaysAgo.setDate(tenDaysAgo.getDate() - 10);

      const emotions: TimestampedEmotion[] = [
        { timestamp: now, emotion: mockEmotion({ sentiment: 0.5 }) },
        { timestamp: sevenDaysAgo, emotion: mockEmotion({ sentiment: 0.3 }) },
        { timestamp: tenDaysAgo, emotion: mockEmotion({ sentiment: -0.5 }) },
      ];

      const metrics7d = computeMetricsForWindow(emotions, 7, now);
      const metrics30d = computeMetricsForWindow(emotions, 30, now);

      // 7d window should only include first 2 messages
      expect(metrics7d.totalMessages).toBe(2);
      expect(metrics7d.avgSentiment).toBe(0.4);

      // 30d window should include all 3
      expect(metrics30d.totalMessages).toBe(3);
      expect(metrics30d.avgSentiment).toBeCloseTo(0.1, 1);
    });
  });

  describe("computeDailyMetrics", () => {
    it("should group emotions by date", () => {
      const day1 = new Date("2024-01-01T10:00:00Z");
      const day1Later = new Date("2024-01-01T15:00:00Z");
      const day2 = new Date("2024-01-02T10:00:00Z");

      const emotions: TimestampedEmotion[] = [
        { timestamp: day1, emotion: mockEmotion({ sentiment: 0.5 }) },
        { timestamp: day1Later, emotion: mockEmotion({ sentiment: 0.3 }) },
        { timestamp: day2, emotion: mockEmotion({ sentiment: -0.2 }) },
      ];

      const daily = computeDailyMetrics(emotions);

      expect(daily.length).toBe(2);
      expect(daily[0].date).toBe("2024-01-01");
      expect(daily[0].metrics.totalMessages).toBe(2);
      expect(daily[0].metrics.avgSentiment).toBe(0.4);
      expect(daily[1].date).toBe("2024-01-02");
      expect(daily[1].metrics.totalMessages).toBe(1);
    });

    it("should return sorted by date", () => {
      const day3 = new Date("2024-01-03T10:00:00Z");
      const day1 = new Date("2024-01-01T10:00:00Z");
      const day2 = new Date("2024-01-02T10:00:00Z");

      const emotions: TimestampedEmotion[] = [
        { timestamp: day3, emotion: mockEmotion() },
        { timestamp: day1, emotion: mockEmotion() },
        { timestamp: day2, emotion: mockEmotion() },
      ];

      const daily = computeDailyMetrics(emotions);

      expect(daily[0].date).toBe("2024-01-01");
      expect(daily[1].date).toBe("2024-01-02");
      expect(daily[2].date).toBe("2024-01-03");
    });
  });
});
