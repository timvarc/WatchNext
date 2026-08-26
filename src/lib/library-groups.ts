import { randomUUID } from "node:crypto";
import type Database from "better-sqlite3";
import { getDb } from "./db";
import type { LibraryGroup } from "./types";

interface LibraryGroupRow {
  id: string;
  name: string;
  section_keys: string;
  created_at: string;
}

function toLibraryGroup(row: LibraryGroupRow): LibraryGroup {
  return {
    id: row.id,
    name: row.name,
    sectionKeys: JSON.parse(row.section_keys),
    createdAt: row.created_at,
  };
}

export function listLibraryGroups(db: Database.Database = getDb()): LibraryGroup[] {
  const rows = db
    .prepare<[], LibraryGroupRow>(
      `SELECT * FROM library_groups ORDER BY created_at ASC`,
    )
    .all();
  return rows.map(toLibraryGroup);
}

export function getLibraryGroup(
  id: string,
  db: Database.Database = getDb(),
): LibraryGroup | undefined {
  const row = db
    .prepare<[string], LibraryGroupRow>(`SELECT * FROM library_groups WHERE id = ?`)
    .get(id);
  return row ? toLibraryGroup(row) : undefined;
}

export function createLibraryGroup(
  name: string,
  sectionKeys: string[],
  db: Database.Database = getDb(),
): LibraryGroup {
  const group: LibraryGroup = {
    id: randomUUID(),
    name,
    sectionKeys,
    createdAt: new Date().toISOString(),
  };
  db.prepare(
    `INSERT INTO library_groups (id, name, section_keys, created_at) VALUES (?, ?, ?, ?)`,
  ).run(group.id, group.name, JSON.stringify(group.sectionKeys), group.createdAt);
  return group;
}

export function deleteLibraryGroup(
  id: string,
  db: Database.Database = getDb(),
): boolean {
  const result = db.prepare(`DELETE FROM library_groups WHERE id = ?`).run(id);
  return result.changes > 0;
}
