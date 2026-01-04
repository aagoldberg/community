interface DriverBarProps {
  label: string;
  value: number;
  max: number;
  suffix?: string;
  color: "green" | "red" | "purple" | "blue";
  warning?: boolean;
}

const colorClasses = {
  green: "bg-green-500",
  red: "bg-red-500",
  purple: "bg-purple-500",
  blue: "bg-blue-500",
};

const bgClasses = {
  green: "bg-green-100 dark:bg-green-900/30",
  red: "bg-red-100 dark:bg-red-900/30",
  purple: "bg-purple-100 dark:bg-purple-900/30",
  blue: "bg-blue-100 dark:bg-blue-900/30",
};

export function DriverBar({
  label,
  value,
  max,
  suffix = "",
  color,
  warning = false,
}: DriverBarProps) {
  const percentage = Math.min((value / max) * 100, 100);

  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-sm font-medium text-gray-700 dark:text-gray-300">
          {label}
        </span>
        <span
          className={`text-sm font-medium ${
            warning ? "text-red-600" : "text-gray-900 dark:text-white"
          }`}
        >
          {value}
          {suffix}
        </span>
      </div>
      <div className={`h-2 rounded-full ${bgClasses[color]}`}>
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClasses[color]}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}
