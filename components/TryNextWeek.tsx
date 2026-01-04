import { DashboardData } from "@/lib/cache";

interface Suggestion {
  text: string;
  why: string;
}

interface TryNextWeekProps {
  metrics: DashboardData;
}

export function TryNextWeek({ metrics }: TryNextWeekProps) {
  const suggestions: Suggestion[] = [];

  // Low reciprocity → suggest replying back
  if (metrics.reciprocity.replyBackRate < 30) {
    suggestions.push({
      text: "Reply to 3 people who replied to you",
      why: "Your reply-back rate is low. Responding builds stronger bonds.",
    });
  }

  // Low depth → suggest asking questions
  if (metrics.conversationDepth.avgReplies < 2) {
    suggestions.push({
      text: "End your next 2 posts with a question",
      why: "Questions invite replies and deepen conversations.",
    });
  }

  // High rage → suggest positive framing
  if (metrics.rageDensity.value > 50) {
    suggestions.push({
      text: "Try framing one frustration as a 'what if' instead",
      why: "Your rage density is elevated. Reframing can shift engagement.",
    });
  }

  // Low agency → suggest a call-to-action
  if (metrics.agencyRate.value < 20) {
    suggestions.push({
      text: "Add a clear ask to your next post",
      why: "Agency posts mobilize your community to act.",
    });
  }

  // Low positive rate → suggest gratitude
  if (metrics.positiveRate.value < 40) {
    suggestions.push({
      text: "Share something you're grateful for this week",
      why: "Positive posts tend to drive more engagement.",
    });
  }

  // Low activation → suggest engaging new people
  if (metrics.activation.value < 5) {
    suggestions.push({
      text: "Reply to 3 new people in your feed",
      why: "Engaging new people helps grow your community.",
    });
  }

  // If no suggestions, give a general one
  if (suggestions.length === 0) {
    suggestions.push({
      text: "Keep doing what you're doing!",
      why: "Your metrics look healthy. Stay consistent.",
    });
  }

  // Return top 3
  const topSuggestions = suggestions.slice(0, 3);

  return (
    <section className="bg-purple-50 dark:bg-purple-900/20 rounded-xl p-4">
      <h3 className="font-medium text-sm text-purple-900 dark:text-purple-100 mb-3">
        ✨ Try this next week
      </h3>
      <ul className="space-y-3">
        {topSuggestions.map((suggestion, i) => (
          <li key={i} className="flex gap-3">
            <span className="text-purple-600 dark:text-purple-400 font-medium">
              {i + 1}.
            </span>
            <div>
              <p className="text-sm font-medium text-gray-900 dark:text-white">
                {suggestion.text}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                {suggestion.why}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
