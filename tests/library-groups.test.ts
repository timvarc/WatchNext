import { describe, expect, it, beforeEach } from "vitest";
import Database from "better-sqlite3";
import { SCHEMA } from "@/lib/db";
import {
  createLibraryGroup,
  deleteLibraryGroup,
  getLibraryGroup,
  listLibraryGroups,
} from "@/lib/library-groups";

function makeDb(): Database.Database {
  const db = new Database(":memory:");
  db.exec(SCHEMA);
  return db;
}

describe("library groups CRUD", () => {
  let db: Database.Database;

  beforeEach(() => {
    db = makeDb();
  });

  it("creates a group with a generated id and returns it", () => {
    const group = createLibraryGroup("Kids", ["sec-1", "sec-2"], db);
    expect(group.id).toBeTruthy();
    expect(group.name).toBe("Kids");
    expect(group.sectionKeys).toEqual(["sec-1", "sec-2"]);
  });

  it("lists created groups", () => {
    createLibraryGroup("Mine", ["sec-1"], db);
    createLibraryGroup("Kids", ["sec-2"], db);
    const groups = listLibraryGroups(db);
    expect(groups.map((g) => g.name)).toEqual(["Mine", "Kids"]);
  });

  it("gets a single group by id", () => {
    const created = createLibraryGroup("Mine", ["sec-1"], db);
    const fetched = getLibraryGroup(created.id, db);
    expect(fetched).toEqual(created);
  });

  it("returns undefined for a missing group id", () => {
    expect(getLibraryGroup("nonexistent", db)).toBeUndefined();
  });

  it("deletes a group and reports success", () => {
    const created = createLibraryGroup("Mine", ["sec-1"], db);
    expect(deleteLibraryGroup(created.id, db)).toBe(true);
    expect(getLibraryGroup(created.id, db)).toBeUndefined();
  });

  it("returns false when deleting an already-deleted or missing group", () => {
    const created = createLibraryGroup("Mine", ["sec-1"], db);
    deleteLibraryGroup(created.id, db);
    expect(deleteLibraryGroup(created.id, db)).toBe(false);
  });
});
