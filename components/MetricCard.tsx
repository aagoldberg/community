"use client";

import { useState } from "react";

interface MetricCardProps {
  label: string;
  value: string | number;
  change?: number;
  subtitle?: string;
  tooltip: string;
}

export function MetricCard({
  label,
  value,
  change,
  subtitle,
  tooltip,
}: MetricCardProps) {
  const [showTooltip, setShowTooltip] = useState(false);

  return (
    <div className="relative bg-white dark:bg-gray-900 rounded-xl p-4 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-sm text-gray-500 dark:text-gray-400">
          {label}
        </span>
        <button
          onMouseEnter={() => setShowTooltip(true)}
          onMouseLeave={() => setShowTooltip(false)}
          onFocus={() => setShowTooltip(true)}
          onBlur={() => setShowTooltip(false)}
          className="text-gray-400 hover:text-gray-600 dark:hover:text-gray-300"
        >
          <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-8-3a1 1 0 00-.867.5 1 1 0 11-1.731-1A3 3 0 0113 8a3.001 3.001 0 01-2 2.83V11a1 1 0 11-2 0v-1a1 1 0 011-1 1 1 0 100-2zm0 8a1 1 0 100-2 1 1 0 000 2z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      </div>

      <div className="mt-2">
        <span className="text-2xl font-bold text-gray-900 dark:text-white">
          {value}
        </span>
        {subtitle && (
          <span className="text-sm text-gray-500 dark:text-gray-400 ml-1">
            {subtitle}
          </span>
        )}
      </div>

      {change !== undefined && change !== 0 && (
        <div
          className={`text-sm mt-1 ${
            change >= 0 ? "text-green-600" : "text-red-600"
          }`}
        >
          {change >= 0 ? "↑" : "↓"} {Math.abs(change)}%
        </div>
      )}

      {/* Tooltip */}
      {showTooltip && (
        <div className="absolute z-10 bottom-full left-1/2 transform -translate-x-1/2 mb-2 px-3 py-2 text-xs text-white bg-gray-900 dark:bg-gray-700 rounded-lg shadow-lg max-w-[200px]">
          {tooltip}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 border-4 border-transparent border-t-gray-900 dark:border-t-gray-700" />
        </div>
      )}
    </div>
  );
}
