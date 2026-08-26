"use client";

import type { RecommendationStatus } from "@/lib/types";

const TABS: { status: RecommendationStatus; label: string }[] = [
  { status: "pending", label: "Pending" },
  { status: "yes", label: "Wishlist" },
  { status: "watched", label: "Watched" },
  { status: "no", label: "Dismissed" },
];

interface StatusTabsProps {
  active: RecommendationStatus;
  onChange: (status: RecommendationStatus) => void;
}

export function StatusTabs({ active, onChange }: StatusTabsProps) {
  return (
    <div className="flex gap-1 rounded-lg bg-black/5 p-1 dark:bg-white/5">
      {TABS.map((tab) => (
        <button
          key={tab.status}
          type="button"
          onClick={() => onChange(tab.status)}
          className={`rounded-md px-3 py-1.5 text-sm font-medium transition-colors ${
            active === tab.status
              ? "bg-white shadow-sm dark:bg-black/40"
              : "text-black/60 hover:text-black dark:text-white/60 dark:hover:text-white"
          }`}
        >
          {tab.label}
        </button>
      ))}
    </div>
  );
}
