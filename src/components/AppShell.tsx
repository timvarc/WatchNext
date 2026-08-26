"use client";

import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { RecommendationsBoard } from "@/components/RecommendationsBoard";

const STORAGE_KEY = "watchnext:selectedGroupId";

export function AppShell() {
  const [libraryGroupId, setLibraryGroupId] = useState<string | null>(null);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      // Reading browser storage on mount and syncing it into state is the
      // textbook use of an effect for synchronizing with an external system.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      if (stored) setLibraryGroupId(stored);
    } catch {
      // localStorage unavailable; fall back to "All Libraries"
    }
  }, []);

  const handleSelectGroup = (id: string | null) => {
    setLibraryGroupId(id);
    try {
      if (id) localStorage.setItem(STORAGE_KEY, id);
      else localStorage.removeItem(STORAGE_KEY);
    } catch {
      // best-effort persistence only
    }
  };

  return (
    <>
      <Header libraryGroupId={libraryGroupId} onSelectGroup={handleSelectGroup} />
      <RecommendationsBoard libraryGroupId={libraryGroupId} />
    </>
  );
}
