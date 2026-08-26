"use client";

import { useState } from "react";
import type { RecommendationRow } from "@/lib/types";

const RATING_VALUES = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

const STATUS_BADGE: Record<string, string> = {
  yes: "bg-emerald-600/15 text-emerald-700 dark:text-emerald-400",
  no: "bg-black/10 text-black/60 dark:bg-white/10 dark:text-white/60",
  watched: "bg-sky-600/15 text-sky-700 dark:text-sky-400",
};

interface RecommendationActionsProps {
  recommendation: RecommendationRow;
  onStatusChange: (id: string, status: "yes" | "no" | "watched", userRating?: number) => void;
}

export function RecommendationActions({
  recommendation,
  onStatusChange,
}: RecommendationActionsProps) {
  const [rating, setRating] = useState(false);

  const statusLabel =
    recommendation.status === "yes"
      ? "On wishlist"
      : recommendation.status === "watched"
        ? recommendation.user_rating != null
          ? `Watched · Rated ${recommendation.user_rating}/10`
          : "Watched"
        : "Dismissed";

  if (recommendation.status !== "pending") {
    return (
      <span
        className={`inline-block rounded px-2 py-1 text-xs font-medium ${STATUS_BADGE[recommendation.status]}`}
      >
        {statusLabel}
      </span>
    );
  }

  if (rating) {
    return (
      <div>
        <p className="mb-1 text-xs font-medium text-black/60 dark:text-white/60">Rate it:</p>
        <div className="flex flex-wrap gap-1">
          {RATING_VALUES.map((n) => (
            <button
              key={n}
              type="button"
              onClick={() => onStatusChange(recommendation.id, "watched", n)}
              className="h-7 w-7 rounded bg-sky-600/15 text-xs font-medium text-sky-700 hover:bg-sky-600/25 dark:text-sky-400"
            >
              {n}
            </button>
          ))}
        </div>
        <div className="mt-2 flex gap-3 text-xs">
          <button
            type="button"
            onClick={() => onStatusChange(recommendation.id, "watched")}
            className="text-black/50 hover:underline dark:text-white/50"
          >
            Skip rating
          </button>
          <button
            type="button"
            onClick={() => setRating(false)}
            className="text-black/50 hover:underline dark:text-white/50"
          >
            Cancel
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex gap-2">
      <button
        type="button"
        onClick={() => onStatusChange(recommendation.id, "yes")}
        className="flex-1 rounded bg-emerald-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-emerald-700"
      >
        Yes
      </button>
      <button
        type="button"
        onClick={() => setRating(true)}
        className="flex-1 rounded bg-sky-600/15 px-3 py-1.5 text-sm font-medium text-sky-700 hover:bg-sky-600/25 dark:text-sky-400"
      >
        Watched
      </button>
      <button
        type="button"
        onClick={() => onStatusChange(recommendation.id, "no")}
        className="flex-1 rounded bg-black/10 px-3 py-1.5 text-sm font-medium hover:bg-black/20 dark:bg-white/10 dark:hover:bg-white/20"
      >
        No
      </button>
    </div>
  );
}
