import Dexie from "dexie";

export const db = new Dexie("ux-heuristics-db");

db.version(1).stores({
  evaluations: "++id,createdAt,title"
});
