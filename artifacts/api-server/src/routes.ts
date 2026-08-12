import { Router } from "express";
import { and, asc, eq } from "drizzle-orm";
import { db } from "../../../lib/db/src/index";
import { gameCards, gameEvents, gamePlayers, gameRooms, gameRosters } from "../../../lib/db/src/schema/index";

const router = Router();
const cardTypes = ["double-shot", "silencer", "shield", "informant", "swap", "camera"];
const code = () => Math.random().toString(36).slice(2, 8).toUpperCase();

router.get("/health", (_req, res) => res.json({ ok: true, service: "qatalin-game" }));

router.post("/rooms", async (req, res) => {
  const displayName = String(req.body?.displayName ?? "").trim();
  const teamName = String(req.body?.teamName ?? "").trim();
  if (!displayName || !teamName) return res.status(400).json({ message: "اسم اللاعب والفريق مطلوبان" });
  if (displayName.length > 80 || teamName.length > 80) return res.status(400).json({ message: "الاسم يجب ألا يتجاوز 80 حرفاً" });

  try {
    let room: typeof gameRooms.$inferSelect | undefined;
    for (let attempt = 0; attempt < 5 && !room; attempt += 1) {
      const [created] = await db.insert(gameRooms).values({ code: code() }).onConflictDoNothing({ target: gameRooms.code }).returning();
      room = created;
    }
    if (!room) return res.status(503).json({ message: "تعذر حجز كود الغرفة، حاول مرة أخرى" });
    const [player] = await db.insert(gamePlayers).values({ roomId: room.id, displayName, teamName }).returning();
    if (!player) return res.status(503).json({ message: "تعذر إنشاء اللاعب داخل الغرفة" });
    return res.status(201).json({ roomCode: room.code, playerId: player.id });
  } catch (error) {
    console.error("[v0] room creation failed", error);
    return res.status(500).json({ message: "تعذر إنشاء الغرفة حالياً" });
  }
});

router.post("/rooms/:roomCode/join", async (req, res) => {
  const displayName = String(req.body?.displayName ?? "").trim();
  const teamName = String(req.body?.teamName ?? "").trim();
  const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, req.params.roomCode.toUpperCase()));
  if (!room) return res.status(404).json({ message: "الغرفة غير موجودة" });
  if (!displayName || !teamName) return res.status(400).json({ message: "اسم اللاعب والفريق مطلوبان" });
  const existingPlayers = await db.select({ id: gamePlayers.id }).from(gamePlayers).where(eq(gamePlayers.roomId, room.id));
  if (existingPlayers.length >= 15) return res.status(409).json({ message: "الغرفة مكتملة — الحد الأقصى 15 لاعباً" });
  if (room.status !== "lobby") return res.status(409).json({ message: "بدأت اللعبة بالفعل ولا يمكن الانضمام الآن" });
  const [player] = await db.insert(gamePlayers).values({ roomId: room.id, displayName, teamName }).returning();
  return res.status(201).json({ roomCode: room.code, playerId: player.id });
});

router.get("/rooms/:roomCode", async (req, res) => {
  const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, req.params.roomCode.toUpperCase()));
  if (!room) return res.status(404).json({ message: "الغرفة غير موجودة" });
  const players = await db.select({ id: gamePlayers.id, displayName: gamePlayers.displayName, teamName: gamePlayers.teamName, isReady: gamePlayers.isReady }).from(gamePlayers).where(eq(gamePlayers.roomId, room.id)).orderBy(asc(gamePlayers.joinedAt));
  return res.json({ room: { code: room.code, status: room.status, phase: room.phase, round: room.round }, players });
});

router.post("/rooms/:roomCode/ready", async (req, res) => {
  const playerId = String(req.body?.playerId ?? "");
  const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, req.params.roomCode.toUpperCase()));
  if (!room) return res.status(404).json({ message: "الغرفة غير موجودة" });
  await db.update(gamePlayers).set({ isReady: true }).where(and(eq(gamePlayers.id, playerId), eq(gamePlayers.roomId, room.id)));
  const players = await db.select().from(gamePlayers).where(eq(gamePlayers.roomId, room.id));
  if (players.length >= 2 && players.length <= 15 && players.every((p: typeof gamePlayers.$inferSelect) => p.isReady)) await db.update(gameRooms).set({ status: "playing", phase: "question", round: 1, currentPlayerId: players[0].id }).where(eq(gameRooms.id, room.id));
  return res.json({ ok: true });
});

router.post("/rooms/:roomCode/roster", async (req, res) => {
  const playerId = String(req.body?.playerId ?? "");
  const roster = Array.isArray(req.body?.roster) ? req.body.roster : [];
  if (roster.length !== 10 || roster.filter((p: { isBoss?: boolean }) => p.isBoss).length !== 2) return res.status(400).json({ message: "يجب إدخال 10 لاعبين وزعيمين فقط" });
  await db.delete(gameRosters).where(eq(gameRosters.playerId, playerId));
  await db.insert(gameRosters).values(roster.map((p: { name: string; position?: string; isBoss: boolean }, index: number) => ({ playerId, slot: index + 1, footballerName: String(p.name).trim(), position: String(p.position ?? "غير محدد"), isBoss: Boolean(p.isBoss) })));
  for (const type of cardTypes.sort(() => Math.random() - 0.5).slice(0, 3)) await db.insert(gameCards).values({ playerId, cardType: type });
  return res.json({ ok: true, cards: 3 });
});

router.get("/rooms/:roomCode/cards/:playerId", async (req, res) => {
  const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, req.params.roomCode.toUpperCase()));
  if (!room) return res.status(404).json({ message: "الغرفة غير موجودة" });
  const cards = await db.select({ id: gameCards.id, cardType: gameCards.cardType, usedAt: gameCards.usedAt }).from(gameCards).where(eq(gameCards.playerId, req.params.playerId));
  return res.json({ cards });
});

router.post("/rooms/:roomCode/cards/:cardId/use", async (req, res) => {
  const [card] = await db.select().from(gameCards).where(eq(gameCards.id, req.params.cardId));
  if (!card || card.playerId !== String(req.body?.playerId ?? "")) return res.status(404).json({ message: "الكرت غير موجود" });
  if (card.usedAt) return res.status(409).json({ message: "تم استخدام هذا الكرت من قبل" });
  await db.update(gameCards).set({ usedAt: new Date() }).where(eq(gameCards.id, card.id));
  return res.json({ ok: true, cardType: card.cardType });
});

router.post("/rooms/:roomCode/events", async (req, res) => {
  const [room] = await db.select().from(gameRooms).where(eq(gameRooms.code, req.params.roomCode.toUpperCase()));
  if (!room) return res.status(404).json({ message: "الغرفة غير موجودة" });
  const actorId = String(req.body?.actorId ?? "");
  const eventType = String(req.body?.eventType ?? "question");
  const allowed = ["question", "reveal", "exclude", "assassinate"];
  if (!allowed.includes(eventType)) return res.status(400).json({ message: "نوع العملية غير صالح" });
  const [actor] = await db.select().from(gamePlayers).where(and(eq(gamePlayers.id, actorId), eq(gamePlayers.roomId, room.id)));
  if (!actor) return res.status(403).json({ message: "لاعب غير مصرح له" });
  if (room.status !== "playing") return res.status(409).json({ message: "اللعبة لم تبدأ بعد" });
  const [event] = await db.insert(gameEvents).values({ roomId: room.id, actorId, targetId: req.body?.targetId, eventType, payload: req.body?.payload ?? {} }).returning();
  await db.update(gameRooms).set({ phase: eventType === "assassinate" || eventType === "exclude" ? "question" : eventType, round: room.round + (eventType === "assassinate" || eventType === "exclude" ? 1 : 0), currentPlayerId: actorId }).where(eq(gameRooms.id, room.id));
  return res.status(201).json({ eventId: event.id, phase: eventType });
});

export default router;
