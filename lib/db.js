import Dexie from "dexie";

export const db = new Dexie("ux-heuristics-db");

db.version(1).stores({
  evaluations: "++id,createdAt,title"
});

// v2: results field stores structured JSON array instead of raw text
db.version(2).stores({
  evaluations: "++id,createdAt,title"
});
