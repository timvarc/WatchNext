"use client";

import Image from "next/image";
import { buildTmdbPosterUrl } from "@/lib/posters";
import { RecommendationActions } from "@/components/RecommendationActions";
import type { RecommendationRow } from "@/lib/types";

interface RecommendationCardProps {
  recommendation: RecommendationRow;
  onStatusChange: (id: string, status: "yes" | "no" | "watched", userRating?: number) => void;
  onOpen: (recommendation: RecommendationRow) => void;
}

export function RecommendationCard({
  recommendation,
  onStatusChange,
  onOpen,
}: RecommendationCardProps) {
  const posterUrl = buildTmdbPosterUrl(recommendation.poster_path);

  return (
    <div
      onClick={() => onOpen(recommendation)}
      className="flex cursor-pointer flex-col overflow-hidden rounded-lg border border-black/10 bg-white shadow-sm transition-shadow hover:shadow-md dark:border-white/10 dark:bg-black/20"
    >
      <div className="relative aspect-[2/3] w-full bg-black/5 dark:bg-white/5">
        {posterUrl ? (
          <Image
            src={posterUrl}
            alt={recommendation.title}
            fill
            sizes="(max-width: 640px) 50vw, 220px"
            className="object-cover"
          />
        ) : (
          <div className="flex h-full items-center justify-center p-4 text-center text-sm text-black/40 dark:text-white/40">
            No poster available
          </div>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-2 p-3">
        <div>
          <h3 className="font-semibold leading-tight">{recommendation.title}</h3>
          <p className="text-xs text-black/50 dark:text-white/50">
            {recommendation.year ?? "Unknown year"} ·{" "}
            {recommendation.media_type === "tv" ? "TV" : "Movie"}
            {recommendation.vote_average != null &&
              ` · ★ ${recommendation.vote_average.toFixed(1)}`}
          </p>
        </div>

        {recommendation.overview && (
          <p className="line-clamp-3 text-sm text-black/70 dark:text-white/70">
            {recommendation.overview}
          </p>
        )}

        {recommendation.reason && (
          <p className="line-clamp-4 rounded bg-amber-500/10 p-2 text-xs italic text-amber-800 dark:text-amber-300">
            Why: {recommendation.reason}
          </p>
        )}

        <div className="mt-auto pt-2" onClick={(e) => e.stopPropagation()}>
          <RecommendationActions
            recommendation={recommendation}
            onStatusChange={onStatusChange}
          />
        </div>
      </div>
    </div>
  );
}
