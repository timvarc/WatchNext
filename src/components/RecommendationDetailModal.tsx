"use client";

import { useEffect } from "react";
import Image from "next/image";
import { buildTmdbPosterUrl } from "@/lib/posters";
import { RecommendationActions } from "@/components/RecommendationActions";
import type { RecommendationRow } from "@/lib/types";

interface RecommendationDetailModalProps {
  recommendation: RecommendationRow;
  onClose: () => void;
  onStatusChange: (id: string, status: "yes" | "no" | "watched", userRating?: number) => void;
  onFetchedChange?: (id: string, fetched: boolean) => void;
}

export function RecommendationDetailModal({
  recommendation,
  onClose,
  onStatusChange,
  onFetchedChange,
}: RecommendationDetailModalProps) {
  useEffect(() => {
    const handleKeydown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeydown);
    return () => window.removeEventListener("keydown", handleKeydown);
  }, [onClose]);

  const posterUrl = buildTmdbPosterUrl(recommendation.poster_path);

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="flex max-h-[85vh] w-full max-w-3xl flex-col overflow-hidden rounded-lg bg-white shadow-xl dark:bg-zinc-900 sm:flex-row"
      >
        <div className="relative h-56 w-full flex-shrink-0 bg-black/5 dark:bg-white/5 sm:h-auto sm:w-64">
          {posterUrl ? (
            <Image
              src={posterUrl}
              alt={recommendation.title}
              fill
              sizes="256px"
              className="object-cover"
            />
          ) : (
            <div className="flex h-full items-center justify-center p-4 text-center text-sm text-black/40 dark:text-white/40">
              No poster available
            </div>
          )}
        </div>

        <div className="flex flex-1 flex-col gap-3 overflow-y-auto p-5">
          <div className="flex items-start justify-between gap-3">
            <div>
              <h2 className="text-lg font-bold leading-tight">{recommendation.title}</h2>
              <p className="text-sm text-black/50 dark:text-white/50">
                {recommendation.year ?? "Unknown year"} ·{" "}
                {recommendation.media_type === "tv" ? "TV" : "Movie"}
                {recommendation.vote_average != null &&
                  ` · ★ ${recommendation.vote_average.toFixed(1)}`}
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded px-2 py-1 text-black/50 hover:bg-black/5 dark:text-white/50 dark:hover:bg-white/10"
            >
              Close
            </button>
          </div>

          {recommendation.overview && (
            <p className="text-sm text-black/70 dark:text-white/70">
              {recommendation.overview}
            </p>
          )}

          {recommendation.reason && (
            <p className="rounded bg-amber-500/10 p-3 text-sm italic text-amber-800 dark:text-amber-300">
              Why: {recommendation.reason}
            </p>
          )}

          <div className="mt-auto pt-2">
            <RecommendationActions
              recommendation={recommendation}
              onStatusChange={onStatusChange}
              onFetchedChange={onFetchedChange}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
