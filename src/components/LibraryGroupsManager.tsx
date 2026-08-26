"use client";

import { useCallback, useEffect, useState } from "react";
import type { LibraryGroup } from "@/lib/types";
import type { PlexSection } from "@/lib/plex";

interface LibraryGroupsManagerProps {
  groups: LibraryGroup[];
  onGroupsChanged: () => void;
  onClose: () => void;
}

export function LibraryGroupsManager({
  groups,
  onGroupsChanged,
  onClose,
}: LibraryGroupsManagerProps) {
  const [sections, setSections] = useState<PlexSection[]>([]);
  const [loadingSections, setLoadingSections] = useState(true);
  const [name, setName] = useState("");
  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const loadSections = useCallback(async () => {
    setLoadingSections(true);
    try {
      const res = await fetch("/api/sections");
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to load libraries");
      setSections((await res.json()) as PlexSection[]);
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setLoadingSections(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    loadSections();
  }, [loadSections]);

  const toggleSection = (key: string) => {
    setSelectedKeys((current) => {
      const next = new Set(current);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleCreate = useCallback(async () => {
    if (!name.trim() || selectedKeys.size === 0) return;
    setCreating(true);
    setError(null);
    try {
      const res = await fetch("/api/library-groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: name.trim(), sectionKeys: [...selectedKeys] }),
      });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to create group");
      setName("");
      setSelectedKeys(new Set());
      onGroupsChanged();
    } catch (err) {
      setError((err as Error).message);
    } finally {
      setCreating(false);
    }
  }, [name, selectedKeys, onGroupsChanged]);

  const handleDelete = useCallback(
    async (id: string) => {
      setError(null);
      try {
        const res = await fetch(`/api/library-groups/${id}`, { method: "DELETE" });
        if (!res.ok) throw new Error((await res.json()).error ?? "Failed to delete group");
        onGroupsChanged();
      } catch (err) {
        setError((err as Error).message);
      }
    },
    [onGroupsChanged],
  );

  return (
    <div className="rounded-lg border border-black/10 bg-white p-4 dark:border-white/10 dark:bg-black/20">
      <div className="flex items-center justify-between">
        <h2 className="font-semibold">Manage Libraries</h2>
        <button
          type="button"
          onClick={onClose}
          className="text-sm text-black/50 hover:text-black dark:text-white/50 dark:hover:text-white"
        >
          Close
        </button>
      </div>

      {error && (
        <p className="mt-2 rounded bg-red-500/10 p-2 text-sm text-red-700 dark:text-red-400">
          {error}
        </p>
      )}

      <div className="mt-3">
        <h3 className="text-sm font-medium text-black/70 dark:text-white/70">
          Existing groups
        </h3>
        {groups.length === 0 ? (
          <p className="mt-1 text-sm text-black/50 dark:text-white/50">
            No groups yet — create one below.
          </p>
        ) : (
          <ul className="mt-1 flex flex-col gap-1">
            {groups.map((group) => (
              <li
                key={group.id}
                className="flex items-center justify-between rounded bg-black/5 px-2 py-1 text-sm dark:bg-white/5"
              >
                <span>
                  {group.name}{" "}
                  <span className="text-black/40 dark:text-white/40">
                    ({group.sectionKeys.length} libraries)
                  </span>
                </span>
                <button
                  type="button"
                  onClick={() => handleDelete(group.id)}
                  className="text-xs text-red-600 hover:underline dark:text-red-400"
                >
                  Delete
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="mt-4 border-t border-black/10 pt-3 dark:border-white/10">
        <h3 className="text-sm font-medium text-black/70 dark:text-white/70">
          Create a new group
        </h3>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g. Mine, Kids"
          className="mt-2 w-full rounded border border-black/15 bg-transparent px-2 py-1.5 text-sm dark:border-white/15"
        />
        <div className="mt-2 flex flex-col gap-1">
          {loadingSections ? (
            <p className="text-sm text-black/50 dark:text-white/50">Loading libraries…</p>
          ) : sections.length === 0 ? (
            <p className="text-sm text-black/50 dark:text-white/50">
              No Plex libraries found.
            </p>
          ) : (
            sections.map((section) => (
              <label key={section.key} className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={selectedKeys.has(section.key)}
                  onChange={() => toggleSection(section.key)}
                />
                {section.title}{" "}
                <span className="text-black/40 dark:text-white/40">({section.type})</span>
              </label>
            ))
          )}
        </div>
        <button
          type="button"
          onClick={handleCreate}
          disabled={creating || !name.trim() || selectedKeys.size === 0}
          className="mt-3 rounded bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-indigo-700 disabled:opacity-50"
        >
          {creating ? "Creating…" : "Create Group"}
        </button>
      </div>
    </div>
  );
}
