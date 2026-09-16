import { randomUUID } from "node:crypto";
import { Router, type IRouter, type Request } from "express";
import { pool } from "@workspace/db";

type PlayerRow = {
  id: string;
  displayName: string;
  teamName: string;
  isReady: boolean;
};

type Footballer = {
  name: string;
  isBoss: boolean;
  status: "active" | "excluded" | "assassinated";
  revealed: boolean;
};

type Team = {
  owner: string;
  ownerId: string;
  teamName: string;
  footballers: Footballer[];
};

const router: IRouter = Router();
const maxPlayers = 15;
const cardTypes = ["double-shot", "silencer", "shield", "informant", "swap", "camera"];

const clean = (value: unknown, max = 120) =>
  String(value ?? "").trim().slice(0, max);

const makeToken = () => `${randomUUID()}-${randomUUID()}`;
const isUuid = (value: unknown) =>
  typeof value === "string" &&
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

const makeRoomCode = () =>
  randomUUID().replace(/-/g, "").slice(0, 6).toUpperCase();

function requestToken(req: Request, body: Record<string, unknown> = {}) {
  const authorization = req.headers.authorization;
  if (authorization?.startsWith("Bearer ")) return authorization.slice(7);
  return typeof body.sessionToken === "string" ? body.sessionToken : "";
}

async function findRoom(code: string) {
  const result = await pool.query(
    `SELECT id, code, status, phase, round, current_player_id AS "currentPlayerId"
     FROM game_rooms WHERE code = $1 LIMIT 1`,
    [code.toUpperCase()],
  );
  return result.rows[0] as
    | {
        id: string;
        code: string;
        status: string;
        phase: string;
        round: number;
        currentPlayerId: string | null;
      }
    | undefined;
}

async function authenticate(
  roomId: string,
  playerId: unknown,
  sessionToken: unknown,
) {
  if (!isUuid(playerId)) return undefined;
  const result = await pool.query(
    `SELECT id, display_name AS "displayName", team_name AS "teamName",
            is_ready AS "isReady"
     FROM game_players
     WHERE id = $1 AND room_id = $2 AND session_token = $3`,
    [clean(playerId), roomId, clean(sessionToken, 100)],
  );
  return result.rows[0] as (PlayerRow & { id: string }) | undefined;
}

function visibleGameState(
  state: Record<string, unknown> | null,
  viewerId: string,
) {
  if (!state || !Array.isArray(state.teams)) return state;
  return {
    ...state,
    teams: (state.teams as Team[]).map((team) => ({
      ...team,
      footballers: team.footballers.map((player) => {
        if (team.ownerId === viewerId || player.revealed) return { ...player };
        const { isBoss: _hiddenBoss, ...safePlayer } = player;
        return safePlayer;
      }),
    })),
  };
}

function validRoster(roster: unknown) {
  if (!Array.isArray(roster) || roster.length !== 10) return false;
  const names = roster.map((item) => clean((item as { name?: unknown })?.name, 100));
  const normalized = names.map((name) => name.toLocaleLowerCase());
  return (
    names.every(Boolean) &&
    new Set(normalized).size === names.length &&
    roster.filter((item) => Boolean((item as { isBoss?: unknown })?.isBoss)).length === 2
  );
}

router.post("/rooms", async (req, res) => {
  const displayName = clean(req.body?.displayName, 80);
  const teamName = clean(req.body?.teamName, 80);
  if (!displayName || !teamName) {
    res.status(400).json({ message: "اسم اللاعب والفريق مطلوبان" });
    return;
  }

  for (let attempt = 0; attempt < 8; attempt += 1) {
    const roomId = randomUUID();
    const playerId = randomUUID();
    const sessionToken = makeToken();
    const result = await pool.query(
      `INSERT INTO game_rooms (id, code) VALUES ($1, $2)
       ON CONFLICT (code) DO NOTHING RETURNING code`,
      [roomId, makeRoomCode()],
    );
    if (!result.rows[0]) continue;
    await pool.query(
      `INSERT INTO game_players
       (id, room_id, display_name, team_name, session_token)
       VALUES ($1, $2, $3, $4, $5)`,
      [playerId, roomId, displayName, teamName, sessionToken],
    );
    res.status(201).json({
      roomCode: result.rows[0].code,
      playerId,
      sessionToken,
    });
    return;
  }

  res.status(503).json({ message: "تعذر إنشاء الغرفة، حاول مرة أخرى" });
});

router.post("/rooms/:roomCode/join", async (req, res) => {
  const roomCode = clean(req.params.roomCode, 8).toUpperCase();
  const room = await findRoom(roomCode);
  if (!room) {
    res.status(404).json({ message: "الغرفة غير موجودة" });
    return;
  }
  if (room.status !== "lobby") {
    res.status(409).json({ message: "بدأت اللعبة بالفعل ولا يمكن الانضمام الآن" });
    return;
  }
  const count = await pool.query(
    "SELECT COUNT(*)::int AS count FROM game_players WHERE room_id = $1",
    [room.id],
  );
  if (Number(count.rows[0]?.count) >= maxPlayers) {
    res.status(409).json({ message: "الغرفة مكتملة — الحد الأقصى 15 لاعباً" });
    return;
  }

  const displayName = clean(req.body?.displayName, 80);
  const teamName = clean(req.body?.teamName, 80);
  if (!displayName || !teamName) {
    res.status(400).json({ message: "اسم اللاعب والفريق مطلوبان" });
    return;
  }
  const playerId = randomUUID();
  const sessionToken = makeToken();
  await pool.query(
    `INSERT INTO game_players
     (id, room_id, display_name, team_name, session_token)
     VALUES ($1, $2, $3, $4, $5)`,
    [playerId, room.id, displayName, teamName, sessionToken],
  );
  res.status(201).json({ roomCode, playerId, sessionToken });
});

router.get("/rooms/:roomCode", async (req, res) => {
  const room = await findRoom(clean(req.params.roomCode, 8));
  if (!room) {
    res.status(404).json({ message: "الغرفة غير موجودة" });
    return;
  }
  const viewer = await authenticate(
    room.id,
    req.query.playerId,
    requestToken(req),
  );
  if (!viewer) {
    res.status(401).json({ message: "جلسة اللاعب غير صالحة" });
    return;
  }

  const players = await pool.query(
    `SELECT id, display_name AS "displayName", team_name AS "teamName",
            is_ready AS "isReady"
     FROM game_players WHERE room_id = $1 ORDER BY joined_at ASC`,
    [room.id],
  );
  const state = await pool.query(
    `SELECT game_state AS "gameState" FROM game_rooms WHERE id = $1`,
    [room.id],
  );
  const gameState = (state.rows[0]?.gameState ?? null) as Record<
    string,
    unknown
  > | null;
  res.json({
    room,
    players: players.rows,
    gameState: visibleGameState(gameState, viewer.id),
  });
});

router.post("/rooms/:roomCode/roster", async (req, res) => {
  const room = await findRoom(clean(req.params.roomCode, 8));
  if (!room) {
    res.status(404).json({ message: "الغرفة غير موجودة" });
    return;
  }
  const playerId = clean(req.body?.playerId);
  if (!await authenticate(room.id, playerId, req.body?.sessionToken)) {
    res.status(401).json({ message: "جلسة اللاعب غير صالحة" });
    return;
  }
  const roster = req.body?.roster;
  if (!validRoster(roster)) {
    res.status(400).json({
      message: "يجب إدخال 10 لاعبين بأسماء مختلفة وزعيمين فقط",
    });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    await client.query("DELETE FROM game_rosters WHERE player_id = $1", [playerId]);
    for (const [index, item] of (roster as Array<{ name: string; isBoss?: boolean }>).entries()) {
      await client.query(
        `INSERT INTO game_rosters
         (id, player_id, slot, footballer_name, is_boss)
         VALUES ($1, $2, $3, $4, $5)`,
        [
          randomUUID(),
          playerId,
          index + 1,
          clean(item.name, 100),
          Boolean(item.isBoss),
        ],
      );
    }
    await client.query("COMMIT");
    res.json({ ok: true });
  } catch (error) {
    await client.query("ROLLBACK");
    throw error;
  } finally {
    client.release();
  }
});

router.post("/rooms/:roomCode/ready", async (req, res) => {
  const room = await findRoom(clean(req.params.roomCode, 8));
  if (!room) {
    res.status(404).json({ message: "الغرفة غير موجودة" });
    return;
  }
  const playerId = clean(req.body?.playerId);
  if (!await authenticate(room.id, playerId, req.body?.sessionToken)) {
    res.status(401).json({ message: "جلسة اللاعب غير صالحة" });
    return;
  }
  const rosterCount = await pool.query(
    "SELECT COUNT(*)::int AS count FROM game_rosters WHERE player_id = $1",
    [playerId],
  );
  if (Number(rosterCount.rows[0]?.count) !== 10) {
    res.status(400).json({ message: "جهّز فريقك من 10 لاعبين وزعيمين قبل الجاهزية" });
    return;
  }
  await pool.query(
    "UPDATE game_players SET is_ready = true WHERE id = $1 AND room_id = $2",
    [playerId, room.id],
  );

  const playersResult = await pool.query(
    `SELECT id, display_name AS "displayName", team_name AS "teamName",
            is_ready AS "isReady"
     FROM game_players WHERE room_id = $1 ORDER BY joined_at ASC`,
    [room.id],
  );
  const players = playersResult.rows as Array<PlayerRow & { id: string }>;
  const started =
    players.length >= 2 &&
    players.length <= maxPlayers &&
    players.every((player) => player.isReady);

  if (started && room.status === "lobby") {
    const rosterResult = await pool.query(
      `SELECT player_id AS "playerId", footballer_name AS "footballerName",
              is_boss AS "isBoss"
       FROM game_rosters WHERE player_id = ANY($1::uuid[]) ORDER BY slot ASC`,
      [players.map((player) => player.id)],
    );
    const teams: Team[] = players.map((player) => ({
      owner: player.displayName,
      ownerId: player.id,
      teamName: player.teamName,
      footballers: rosterResult.rows
        .filter((item) => item.playerId === player.id)
        .map((item) => ({
          name: item.footballerName,
          isBoss: item.isBoss,
          status: "active" as const,
          revealed: false,
        })),
    }));
    const gameState = {
      version: 2,
      screen: "game",
      phase: "question",
      playerCount: teams.length,
      owners: teams.map((team) => team.owner),
      teams,
      setupIndex: 0,
      round: 1,
      turn: 0,
      targetTeam: null,
      targetPlayer: null,
      exclusionTargets: [],
      revealDecision: "choose",
      revealSourcePlayer: null,
      notes: "",
      winner: null,
      history: [],
    };
    await pool.query(
      `UPDATE game_rooms
       SET status = 'playing', phase = 'question', round = 1,
           current_player_id = $1, game_state = $2::jsonb
       WHERE id = $3 AND status = 'lobby'`,
      [players[0].id, JSON.stringify(gameState), room.id],
    );
  }
  res.json({ ok: true, started });
});

router.get("/rooms/:roomCode/cards/:playerId", async (req, res) => {
  const room = await findRoom(clean(req.params.roomCode, 8));
  if (!room) {
    res.status(404).json({ message: "الغرفة غير موجودة" });
    return;
  }
  const player = await authenticate(
    room.id,
    req.params.playerId,
    requestToken(req),
  );
  if (!player) {
    res.status(401).json({ message: "جلسة اللاعب غير صالحة" });
    return;
  }
  let cards = await pool.query(
    `SELECT id, card_type AS "cardType", used_at AS "usedAt"
     FROM game_cards WHERE player_id = $1 ORDER BY id`,
    [player.id],
  );
  if (!cards.rows.length) {
    const shuffled = [...cardTypes].sort(() => Math.random() - 0.5).slice(0, 3);
    for (const cardType of shuffled) {
      await pool.query(
        `INSERT INTO game_cards (id, player_id, card_type)
         VALUES ($1, $2, $3)`,
        [randomUUID(), player.id, cardType],
      );
    }
    cards = await pool.query(
      `SELECT id, card_type AS "cardType", used_at AS "usedAt"
       FROM game_cards WHERE player_id = $1 ORDER BY id`,
      [player.id],
    );
  }
  res.json({ cards: cards.rows });
});

router.post("/rooms/:roomCode/cards/:cardId/use", async (req, res) => {
  const room = await findRoom(clean(req.params.roomCode, 8));
  if (!room) {
    res.status(404).json({ message: "الغرفة غير موجودة" });
    return;
  }
  const player = await authenticate(
    room.id,
    req.body?.playerId,
    req.body?.sessionToken,
  );
  if (!player) {
    res.status(401).json({ message: "جلسة اللاعب غير صالحة" });
    return;
  }
  if (room.currentPlayerId !== player.id) {
    res.status(409).json({ message: "لا يمكنك استخدام بطاقة خارج دورك" });
    return;
  }
  const result = await pool.query(
    `UPDATE game_cards SET used_at = now()
     WHERE id = $1 AND player_id = $2 AND used_at IS NULL
     RETURNING id, card_type AS "cardType"`,
    [clean(req.params.cardId), player.id],
  );
  if (!result.rows[0]) {
    res.status(409).json({ message: "الكرت غير موجود أو تم استخدامه من قبل" });
    return;
  }
  res.json({ ok: true, cardType: result.rows[0].cardType });
});

router.post("/rooms/:roomCode/events", async (req, res) => {
  const roomCode = clean(req.params.roomCode, 8).toUpperCase();
  const room = await findRoom(roomCode);
  if (!room) {
    res.status(404).json({ message: "الغرفة غير موجودة" });
    return;
  }
  const actorId = clean(req.body?.actorId);
  const actor = await authenticate(room.id, actorId, req.body?.sessionToken);
  if (!actor) {
    res.status(401).json({ message: "جلسة اللاعب غير صالحة" });
    return;
  }
  const eventType = clean(req.body?.eventType, 32);
  if (!["reveal", "exclude", "assassinate"].includes(eventType)) {
    res.status(400).json({ message: "نوع حركة غير مسموح" });
    return;
  }
  if (room.currentPlayerId !== actorId) {
    res.status(409).json({ message: "ليس دور هذا اللاعب حالياً" });
    return;
  }

  const client = await pool.connect();
  try {
    await client.query("BEGIN");
    const stateResult = await client.query(
      `SELECT game_state AS "gameState",
              current_player_id AS "currentPlayerId"
       FROM game_rooms
       WHERE id = $1 FOR UPDATE`,
      [room.id],
    );
    if (stateResult.rows[0]?.currentPlayerId !== actorId) {
      throw new Error("ليس دور هذا اللاعب حالياً");
    }
    const serverState = stateResult.rows[0]?.gameState as Record<string, unknown> | null;
    const proposed = req.body?.payload?.nextState as Record<string, unknown> | undefined;
    if (!serverState || !Array.isArray(serverState.teams) || !proposed) {
      throw new Error("حالة اللعبة غير متاحة");
    }

    const targetName = clean(req.body?.targetId, 100);
    const serverTeams = serverState.teams as Team[];
    const proposedTeamIndex = Number(proposed.targetTeam);
    const proposedPlayerIndex = Number(proposed.targetPlayer);
    const indexedTarget =
      Number.isInteger(proposedTeamIndex) &&
      Number.isInteger(proposedPlayerIndex) &&
      serverTeams[proposedTeamIndex]?.footballers[proposedPlayerIndex];
    if (!indexedTarget || indexedTarget.name !== targetName) {
      throw new Error("يجب تحديد الفريق واللاعب من الحالة الحالية");
    }
    const targetLocation = {
      team: serverTeams[proposedTeamIndex],
      teamIndex: proposedTeamIndex,
      playerIndex: proposedPlayerIndex,
    };
    if (targetLocation.team.ownerId === actorId) {
      throw new Error("لا يمكنك استهداف فريقك");
    }
    const target = targetLocation.team.footballers[targetLocation.playerIndex];
    if (target.status !== "active") throw new Error("هذا اللاعب خرج من المواجهة");
    const currentPhase = clean(serverState.phase, 32);
    const storedTeamIndex = Number(serverState.targetTeam);
    const sourceIndex = Number(serverState.revealSourcePlayer);
    if (eventType === "reveal" && !["question", "target"].includes(currentPhase)) {
      throw new Error("لا يمكن الكشف في هذه المرحلة");
    }
    if (eventType !== "reveal" && currentPhase !== "reveal") {
      throw new Error("يجب كشف لاعب قبل تنفيذ هذه الحركة");
    }

    const nextTeams = serverTeams.map((team) => ({
      ...team,
      footballers: team.footballers.map((player) => ({ ...player })),
    }));
    if (eventType === "reveal") {
      nextTeams[targetLocation.teamIndex].footballers[targetLocation.playerIndex].revealed = true;
    } else {
      const sourceTeam = serverTeams[storedTeamIndex];
      const source = sourceTeam?.footballers[sourceIndex];
      if (storedTeamIndex !== targetLocation.teamIndex || !source) {
        throw new Error("هدف الحركة لا يطابق مرحلة الكشف");
      }
      if (eventType === "exclude") {
        if (
          sourceIndex !== targetLocation.playerIndex ||
          source.isBoss ||
          !source.revealed
        ) {
          throw new Error("لا يمكن استبعاد هذا الهدف");
        }
        nextTeams[storedTeamIndex].footballers[sourceIndex].status = "excluded";
      } else {
        if (
          sourceIndex === targetLocation.playerIndex ||
          !source.isBoss ||
          !source.revealed ||
          source.status !== "active"
        ) {
          throw new Error("لا يمكن تنفيذ الاغتيال قبل كشف زعيم صالح");
        }
        nextTeams[storedTeamIndex].footballers[sourceIndex].status = "assassinated";
        nextTeams[storedTeamIndex].footballers[targetLocation.playerIndex].status =
          target.isBoss ? "assassinated" : "excluded";
      }
    }

    const nextState: Record<string, any> = {
      ...serverState,
      teams: nextTeams,
      onlineRoomCode: undefined,
      onlinePlayerId: undefined,
      onlineSessionToken: undefined,
    };
    if (eventType === "reveal") {
      nextState.phase = "reveal";
      nextState.targetTeam = targetLocation.teamIndex;
      nextState.targetPlayer = targetLocation.playerIndex;
      nextState.revealSourcePlayer = targetLocation.playerIndex;
      nextState.revealDecision = "choose";
      nextState.exclusionTargets = [];
    } else {
      const aliveTeams = nextTeams
        .map((team, index) => ({
          index,
          alive: team.footballers.some(
            (player) => player.isBoss && player.status === "active",
          ),
        }))
        .filter((item) => item.alive);
      const isEnding = aliveTeams.length <= 1;
      let nextTurn = Number(serverState.turn);
      if (!isEnding) {
        nextTurn = (nextTurn + 1) % nextTeams.length;
        while (!aliveTeams.some((item) => item.index === nextTurn)) {
          nextTurn = (nextTurn + 1) % nextTeams.length;
        }
      }
      const actionTargets =
        eventType === "assassinate"
          ? [sourceIndex, targetLocation.playerIndex]
          : [targetLocation.playerIndex];
      const history = [
        ...(Array.isArray(serverState.history) ? serverState.history : []),
        ...actionTargets.map((playerIndex, index) => ({
          round: Number(serverState.round),
          attacker: actor.displayName,
          target: `${serverTeams[storedTeamIndex].footballers[playerIndex].name} — ${serverTeams[storedTeamIndex].owner}`,
          action:
            eventType === "assassinate" || index === 0
              ? "assassinate"
              : "exclude",
        })),
      ];
      Object.assign(nextState, {
        phase: isEnding ? "ending" : "question",
        turn: nextTurn,
        round: Number(serverState.round) + 1,
        targetTeam: null,
        targetPlayer: null,
        exclusionTargets: [],
        revealSourcePlayer: null,
        revealDecision: "choose",
        notes: "",
        winner: isEnding ? aliveTeams[0]?.index ?? null : null,
        history,
      });
    }
    await client.query(
      `INSERT INTO game_events
       (id, room_id, actor_id, target_id, event_type, payload)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [
        randomUUID(),
        room.id,
        actorId,
        targetName,
        eventType,
        JSON.stringify({ round: serverState.round, nextState }),
      ],
    );

    const nextTurn = Number(nextState.turn);
    const nextTeam = nextTeams[nextTurn];
    const isEnding = nextState.phase === "ending";
    await client.query(
      `UPDATE game_rooms SET game_state = $1::jsonb, current_player_id = $2,
              phase = $3, round = $4, status = $5 WHERE id = $6`,
      [
        JSON.stringify(nextState),
        isEnding ? null : nextTeam?.ownerId ?? actorId,
        String(nextState.phase ?? "question"),
        Number(nextState.round ?? room.round),
        isEnding ? "finished" : "playing",
        room.id,
      ],
    );
    await client.query("COMMIT");

    const revealedPlayer = nextTeams[targetLocation.teamIndex]?.footballers[targetLocation.playerIndex];
    res.json({
      ok: true,
      revealedPlayer,
      targetTeam: targetLocation.teamIndex,
      targetPlayer: targetLocation.playerIndex,
    });
  } catch (error) {
    await client.query("ROLLBACK");
    const message = error instanceof Error ? error.message : "تعذر حفظ الحركة";
    res.status(409).json({ message });
  } finally {
    client.release();
  }
});

router.get("/rooms/:roomCode/events", async (req, res) => {
  const room = await findRoom(clean(req.params.roomCode, 8));
  if (!room) {
    res.status(404).json({ message: "الغرفة غير موجودة" });
    return;
  }
  const player = await authenticate(room.id, req.query.playerId, requestToken(req));
  if (!player) {
    res.status(401).json({ message: "جلسة اللاعب غير صالحة" });
    return;
  }
  const events = await pool.query(
    `SELECT id, actor_id AS "actorId", target_id AS "targetId",
            event_type AS "eventType", payload, created_at AS "createdAt"
     FROM game_events WHERE room_id = $1 ORDER BY created_at ASC`,
    [room.id],
  );
  res.json({ events: events.rows });
});

export default router;