"use client";

import { useCallback, useEffect, useState } from "react";
import { LibraryGroupsManager } from "@/components/LibraryGroupsManager";
import type { LibraryGroup } from "@/lib/types";

interface StatusResponse {
  lastSyncedAt: string | null;
  libraryItemCount: number;
}

interface HeaderProps {
  libraryGroupId: string | null;
  onSelectGroup: (id: string | null) => void;
}

export function Header({ libraryGroupId, onSelectGroup }: HeaderProps) {
  const [status, setStatus] = useState<StatusResponse | null>(null);
  const [groups, setGroups] = useState<LibraryGroup[]>([]);
  const [managingLibraries, setManagingLibraries] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadStatus = useCallback(async () => {
    try {
      const res = await fetch("/api/status");
      if (!res.ok) throw new Error("Failed to load status");
      setStatus((await res.json()) as StatusResponse);
    } catch {
      // status is best-effort display data; ignore failures here
    }
  }, []);

  const loadGroups = useCallback(async () => {
    try {
      const res = await fetch("/api/library-groups");
      if (!res.ok) throw new Error("Failed to load library groups");
      setGroups((await res.json()) as LibraryGroup[]);
    } catch {
      // group list is best-effort; ignore failures here
    }
  }, []);

  useEffect(() => {
    // Fetching from the network on mount is the textbook use of an effect;
    // the resulting setState happens asynchronously after the fetch resolves.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadStatus();
    loadGroups();
  }, [loadStatus, loadGroups]);

  const handleSync = useCallback(async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/sync", { method: "POST" });
      if (!res.ok) throw new Error((await res.json()).error ?? "Sync failed");
      await loadStatus();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setSyncing(false);
    }
  }, [loadStatus]);

  const handleGenerate = useCallback(async () => {
    setGenerating(true);
    setError(null);
    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ libraryGroupId: libraryGroupId ?? undefined }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Generation failed");
      window.dispatchEvent(new Event("watchnext:generated"));
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setGenerating(false);
    }
  }, [libraryGroupId]);

  return (
    <header className="flex flex-col gap-3 border-b border-black/10 pb-4 dark:border-white/10">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">WatchNext</h1>
          <p className="text-xs text-black/50 dark:text-white/50">
            {status
              ? `${status.libraryItemCount} library items · Last synced: ${
                  status.lastSyncedAt
                    ? new Date(status.lastSyncedAt).toLocaleString()
                    : "never"
                }`
              : "Loading library status…"}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <select
            value={libraryGroupId ?? ""}
            onChange={(e) => onSelectGroup(e.target.value || null)}
            className="rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
          >
            <option value="">All Libraries</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
              </option>
            ))}
          </select>
          <button
            type="button"
            onClick={() => setManagingLibraries((v) => !v)}
            className="rounded border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/5"
          >
            Manage Libraries
          </button>
          <button
            type="button"
            onClick={handleSync}
            disabled={syncing}
            className="rounded border border-black/15 px-3 py-1.5 text-sm font-medium hover:bg-black/5 disabled:opacity-50 dark:border-white/15 dark:hover:bg-white/5"
          >
            {syncing ? "Syncing…" : "Sync Library"}
          </button>
          <button
            type="button"
            onClick={handleGenerate}
            disabled={generating}
            className="rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
          >
            {generating ? "Generating…" : "Generate Recommendations"}
          </button>
        </div>
      </div>
      {managingLibraries && (
        <LibraryGroupsManager
          groups={groups}
          onGroupsChanged={loadGroups}
          onClose={() => setManagingLibraries(false)}
        />
      )}
      {error && (
        <p className="rounded bg-red-500/10 p-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}
    </header>
  );
}
