import { boolean, integer, jsonb, pgTable, text, timestamp, uuid, varchar } from "drizzle-orm/pg-core";

export const gameRooms = pgTable("game_rooms", {
  id: uuid("id").defaultRandom().primaryKey(),
  code: varchar("code", { length: 8 }).notNull().unique(),
  status: varchar("status", { length: 16 }).notNull().default("lobby"),
  phase: varchar("phase", { length: 16 }).notNull().default("setup"),
  round: integer("round").notNull().default(0),
  currentPlayerId: uuid("current_player_id"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const gamePlayers = pgTable("game_players", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").notNull(),
  displayName: varchar("display_name", { length: 80 }).notNull(),
  teamName: varchar("team_name", { length: 80 }).notNull(),
  isReady: boolean("is_ready").notNull().default(false),
  joinedAt: timestamp("joined_at", { withTimezone: true }).defaultNow().notNull(),
});

export const gameRosters = pgTable("game_rosters", {
  id: uuid("id").defaultRandom().primaryKey(),
  playerId: uuid("player_id").notNull(),
  slot: integer("slot").notNull(),
  footballerName: varchar("footballer_name", { length: 120 }).notNull(),
  position: varchar("position", { length: 40 }).notNull(),
  isBoss: boolean("is_boss").notNull().default(false),
  status: varchar("status", { length: 20 }).notNull().default("active"),
  revealed: boolean("revealed").notNull().default(false),
});

export const gameEvents = pgTable("game_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  roomId: uuid("room_id").notNull(),
  actorId: uuid("actor_id"),
  targetId: uuid("target_id"),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export const gameCards = pgTable("game_cards", {
  id: uuid("id").defaultRandom().primaryKey(),
  playerId: uuid("player_id").notNull(),
  cardType: varchar("card_type", { length: 32 }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
});

export type GameRoom = typeof gameRooms.$inferSelect;
export type GamePlayer = typeof gamePlayers.$inferSelect;
export type GameRoster = typeof gameRosters.$inferSelect;
