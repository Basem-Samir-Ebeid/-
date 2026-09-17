import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";

export const gameRooms = pgTable("game_rooms", {
  id: uuid("id").primaryKey(),
  code: varchar("code", { length: 8 }).notNull().unique(),
  status: varchar("status", { length: 16 }).notNull().default("lobby"),
  phase: varchar("phase", { length: 16 }).notNull().default("setup"),
  round: integer("round").notNull().default(0),
  currentPlayerId: uuid("current_player_id"),
  ownerPlayerId: uuid("owner_player_id"),
  turnDeadlineAt: timestamp("turn_deadline_at", { withTimezone: true }),
  gameState: jsonb("game_state").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gamePlayers = pgTable("game_players", {
  id: uuid("id").primaryKey(),
  roomId: uuid("room_id").notNull().references(() => gameRooms.id, { onDelete: "cascade" }),
  displayName: varchar("display_name", { length: 80 }).notNull(),
  teamName: varchar("team_name", { length: 80 }).notNull(),
  sessionToken: varchar("session_token", { length: 100 }).notNull().unique(),
  isReady: boolean("is_ready").notNull().default(false),
  joinedAt: timestamp("joined_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameRosters = pgTable("game_rosters", {
  id: uuid("id").primaryKey(),
  playerId: uuid("player_id").notNull().references(() => gamePlayers.id, { onDelete: "cascade" }),
  slot: integer("slot").notNull(),
  footballerName: varchar("footballer_name", { length: 100 }).notNull(),
  isBoss: boolean("is_boss").notNull().default(false),
});

export const gameCards = pgTable("game_cards", {
  id: uuid("id").primaryKey(),
  playerId: uuid("player_id").notNull().references(() => gamePlayers.id, { onDelete: "cascade" }),
  cardType: varchar("card_type", { length: 32 }).notNull(),
  usedAt: timestamp("used_at", { withTimezone: true }),
}, (table) => ({
  playerCardTypeUnique: uniqueIndex("game_cards_player_card_type_idx").on(table.playerId, table.cardType),
}));

export const gameVotes = pgTable("game_votes", {
  id: uuid("id").primaryKey(),
  roomId: uuid("room_id").notNull().references(() => gameRooms.id, { onDelete: "cascade" }),
  round: integer("round").notNull(),
  voterId: uuid("voter_id").notNull().references(() => gamePlayers.id, { onDelete: "cascade" }),
  targetId: text("target_id").notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const gameEvents = pgTable("game_events", {
  id: uuid("id").primaryKey(),
  roomId: uuid("room_id").notNull().references(() => gameRooms.id, { onDelete: "cascade" }),
  actorId: uuid("actor_id"),
  targetId: text("target_id"),
  eventType: varchar("event_type", { length: 32 }).notNull(),
  payload: jsonb("payload").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});