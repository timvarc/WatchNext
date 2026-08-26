"use client";

import { useCallback, useEffect, useState } from "react";
import { RecommendationCard } from "@/components/RecommendationCard";
import { RecommendationDetailModal } from "@/components/RecommendationDetailModal";
import { StatusTabs } from "@/components/StatusTabs";
import type { RecommendationRow, RecommendationStatus } from "@/lib/types";

interface RecommendationsBoardProps {
  libraryGroupId: string | null;
}

export function RecommendationsBoard({ libraryGroupId }: RecommendationsBoardProps) {
  const [activeTab, setActiveTab] = useState<RecommendationStatus>("pending");
  const [items, setItems] = useState<RecommendationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<RecommendationRow | null>(null);

  const loadItems = useCallback(
    async (status: RecommendationStatus) => {
      setLoading(true);
      setError(null);
      try {
        const params = new URLSearchParams({ status });
        if (libraryGroupId) params.set("libraryGroupId", libraryGroupId);
        const res = await fetch(`/api/recommendations?${params.toString()}`);
        if (!res.ok) throw new Error("Failed to load recommendations");
        const data = (await res.json()) as RecommendationRow[];
        setItems(data);
      } catch (err) {
        setError((err as Error).message);
      } finally {
        setLoading(false);
      }
    },
    [libraryGroupId],
  );

  useEffect(() => {
    // Fetching from the network on mount/tab-change is the textbook use of an
    // effect; the resulting setState happens asynchronously after the fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadItems(activeTab);
  }, [activeTab, loadItems]);

  useEffect(() => {
    const handleGenerated = () => {
      setActiveTab("pending");
      loadItems("pending");
    };
    window.addEventListener("watchnext:generated", handleGenerated);
    return () => window.removeEventListener("watchnext:generated", handleGenerated);
  }, [loadItems]);

  const handleStatusChange = useCallback(
    async (id: string, status: "yes" | "no" | "watched", userRating?: number) => {
      const previous = items;
      setItems((current) => current.filter((item) => item.id !== id));
      setSelected((current) => (current?.id === id ? null : current));
      try {
        const res = await fetch(`/api/recommendations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ status, userRating }),
        });
        if (!res.ok) throw new Error("Failed to update recommendation");
      } catch (err) {
        setItems(previous);
        setError((err as Error).message);
      }
    },
    [items],
  );

  const handleFetchedChange = useCallback(
    async (id: string, fetched: boolean) => {
      const previous = items;
      const fetchedAt = fetched ? new Date().toISOString() : null;
      const applyFetched = (list: RecommendationRow[]) =>
        list.map((item) => (item.id === id ? { ...item, fetched_at: fetchedAt } : item));
      setItems(applyFetched);
      setSelected((current) => (current ? applyFetched([current])[0] : current));
      try {
        const res = await fetch(`/api/recommendations/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ fetched }),
        });
        if (!res.ok) throw new Error("Failed to update recommendation");
      } catch (err) {
        setItems(previous);
        setError((err as Error).message);
      }
    },
    [items],
  );

  const displayedItems =
    activeTab === "yes"
      ? [...items].sort((a, b) => Number(a.fetched_at != null) - Number(b.fetched_at != null))
      : items;

  return (
    <div className="flex flex-col gap-4">
      <StatusTabs active={activeTab} onChange={setActiveTab} />

      {error && (
        <p className="rounded bg-red-500/10 p-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      {loading ? (
        <p className="text-sm text-black/50 dark:text-white/50">Loading…</p>
      ) : displayedItems.length === 0 ? (
        <p className="text-sm text-black/50 dark:text-white/50">
          {activeTab === "pending"
            ? "No pending recommendations. Click \"Generate Recommendations\" to get started."
            : "Nothing here yet."}
        </p>
      ) : (
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5">
          {displayedItems.map((item) => (
            <RecommendationCard
              key={item.id}
              recommendation={item}
              onStatusChange={handleStatusChange}
              onFetchedChange={handleFetchedChange}
              onOpen={setSelected}
            />
          ))}
        </div>
      )}

      {selected && (
        <RecommendationDetailModal
          recommendation={selected}
          onClose={() => setSelected(null)}
          onStatusChange={handleStatusChange}
          onFetchedChange={handleFetchedChange}
        />
      )}
    </div>
  );
}
