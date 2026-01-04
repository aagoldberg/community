"use client";

import { useState } from "react";
import { ExamplePost } from "@/lib/cache";

interface ExampleTabsProps {
  rage: ExamplePost[];
  agency: ExamplePost[];
}

export function ExampleTabs({ rage, agency }: ExampleTabsProps) {
  const [activeTab, setActiveTab] = useState<"rage" | "agency">("rage");

  const tabs = [
    { key: "rage" as const, label: "Rage", icon: "🔥", count: rage.length },
    { key: "agency" as const, label: "Agency", icon: "🎯", count: agency.length },
  ];

  const posts = activeTab === "rage" ? rage : agency;

  return (
    <div className="bg-white dark:bg-gray-900 rounded-xl shadow-sm overflow-hidden">
      {/* Tab headers */}
      <div className="flex border-b border-gray-200 dark:border-gray-700">
        {tabs.map((tab) => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
              activeTab === tab.key
                ? "text-purple-600 border-b-2 border-purple-600 bg-purple-50 dark:bg-purple-900/20"
                : "text-gray-500 hover:text-gray-700 dark:hover:text-gray-300"
            }`}
          >
            <span className="mr-1">{tab.icon}</span>
            {tab.label}
            <span className="ml-1 text-xs text-gray-400">({tab.count})</span>
          </button>
        ))}
      </div>

      {/* Post list */}
      <div className="divide-y divide-gray-100 dark:divide-gray-800">
        {posts.length === 0 ? (
          <div className="p-4 text-center text-sm text-gray-500">
            No {activeTab} posts found in this period
          </div>
        ) : (
          posts.map((post) => (
            <ExamplePostCard
              key={post.hash}
              post={post}
              type={activeTab}
            />
          ))
        )}
      </div>
    </div>
  );
}

function ExamplePostCard({
  post,
  type,
}: {
  post: ExamplePost;
  type: "rage" | "agency";
}) {
  const colors = {
    rage: "border-l-red-500",
    agency: "border-l-purple-500",
  };

  const formatDate = (timestamp: string) => {
    const date = new Date(timestamp);
    return date.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
    });
  };

  return (
    <div className={`p-4 border-l-4 ${colors[type]}`}>
      <p className="text-sm text-gray-700 dark:text-gray-300 line-clamp-2">
        &ldquo;{post.excerpt}&rdquo;
      </p>
      <div className="flex items-center justify-between mt-2">
        <span className="text-xs text-gray-400">
          {formatDate(post.timestamp)}
          {type === "rage" && (
            <span className="ml-2">
              🔥 {Math.round(post.score * 100)}% confidence
            </span>
          )}
          {type === "agency" && post.score > 0 && (
            <span className="ml-2">💬 {post.score} replies</span>
          )}
        </span>
        <a
          href={`https://warpcast.com/~/conversations/${post.hash}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-xs text-purple-600 hover:text-purple-700 dark:text-purple-400"
        >
          View →
        </a>
      </div>
    </div>
  );
}
