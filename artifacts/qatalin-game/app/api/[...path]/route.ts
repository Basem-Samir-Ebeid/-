import { Signer } from '@aws-sdk/rds-signer'
import { attachDatabasePool } from '@vercel/functions'
import { awsCredentialsProvider } from '@vercel/functions/oidc'
import { Pool } from 'pg'
import { NextResponse } from 'next/server'

const signer = new Signer({
  credentials: awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN, clientConfig: { region: process.env.AWS_REGION } }),
  region: process.env.AWS_REGION,
  hostname: process.env.PGHOST,
  username: process.env.PGUSER ?? 'postgres',
  port: Number(process.env.PGPORT ?? 5432),
})

const pool = new Pool({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT ?? 5432),
  database: process.env.PGDATABASE ?? 'postgres',
  user: process.env.PGUSER ?? 'postgres',
  password: () => signer.getAuthToken(),
  ssl: { rejectUnauthorized: false },
  max: 10,
})
attachDatabasePool(pool)

const json = (body: unknown, status = 200) => NextResponse.json(body, { status })
const code = () => Math.random().toString(36).slice(2, 8).toUpperCase()
const clean = (value: unknown) => String(value ?? '').trim()
let schemaReady: Promise<void> | undefined

async function ensureSchema() {
  if (!schemaReady) {
    schemaReady = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS game_rooms (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          code varchar(8) NOT NULL UNIQUE,
          status varchar(16) NOT NULL DEFAULT 'lobby',
          phase varchar(16) NOT NULL DEFAULT 'setup',
          round integer NOT NULL DEFAULT 0,
          current_player_id uuid,
          created_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE TABLE IF NOT EXISTS game_players (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
          display_name varchar(80) NOT NULL,
          team_name varchar(80) NOT NULL,
          is_ready boolean NOT NULL DEFAULT false,
          joined_at timestamptz NOT NULL DEFAULT now()
        );
        CREATE INDEX IF NOT EXISTS game_players_room_id_idx ON game_players(room_id);
        CREATE TABLE IF NOT EXISTS game_events (
          id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
          room_id uuid NOT NULL REFERENCES game_rooms(id) ON DELETE CASCADE,
          actor_id uuid,
          target_id uuid,
          event_type varchar(32) NOT NULL,
          payload jsonb NOT NULL DEFAULT '{}'::jsonb,
          created_at timestamptz NOT NULL DEFAULT now()
        );
      `)
    })().catch((error) => { schemaReady = undefined; throw error })
  }
  await schemaReady
}

async function resolveRoom(roomCode: string) {
  const result = await pool.query('SELECT * FROM game_rooms WHERE code = $1 LIMIT 1', [roomCode.toUpperCase()])
  return result.rows[0] as { id: string; code: string; status: string; phase: string; round: number } | undefined
}

async function handler(request: Request, context: { params: Promise<{ path?: string[] }> }) {
  const { path = [] } = await context.params
  const method = request.method
  const body = method === 'POST' ? await request.json().catch(() => ({})) : {}
  try {
    if (path[0] === 'health' && method === 'GET') return json({ ok: true, service: 'qatalin-game' })
    if (path[0] !== 'rooms') return json({ message: 'المسار غير موجود' }, 404)
    await ensureSchema()

    if (path.length === 1 && method === 'POST') {
      const displayName = clean(body.displayName)
      const teamName = clean(body.teamName)
      if (!displayName || !teamName) return json({ message: 'اسم اللاعب والفريق مطلوبان' }, 400)
      let room
      for (let attempt = 0; attempt < 5; attempt += 1) {
        const result = await pool.query('INSERT INTO game_rooms (code) VALUES ($1) ON CONFLICT (code) DO NOTHING RETURNING id, code', [code()])
        if (result.rows[0]) { room = result.rows[0]; break }
      }
      if (!room) return json({ message: 'تعذر إنشاء الغرفة، حاول مرة أخرى' }, 503)
      const player = await pool.query('INSERT INTO game_players (room_id, display_name, team_name) VALUES ($1, $2, $3) RETURNING id', [room.id, displayName, teamName])
      return json({ roomCode: room.code, playerId: player.rows[0].id }, 201)
    }

    const roomCode = clean(path[1]).toUpperCase()
    if (!/^[A-Z0-9]{6}$/.test(roomCode)) return json({ message: 'كود الغرفة غير صالح' }, 400)
    const room = await resolveRoom(roomCode)
    if (!room) return json({ message: 'الغرفة غير موجودة' }, 404)

    if (path.length === 2 && method === 'GET') {
      const players = await pool.query('SELECT id, display_name AS "displayName", team_name AS "teamName", is_ready AS "isReady" FROM game_players WHERE room_id = $1 ORDER BY joined_at ASC', [room.id])
      return json({ room, players: players.rows })
    }
    if (path[2] === 'join' && method === 'POST') {
      const displayName = clean(body.displayName)
      const teamName = clean(body.teamName)
      if (!displayName || !teamName) return json({ message: 'اسم اللاعب والفريق مطلوبان' }, 400)
      if (room.status !== 'lobby') return json({ message: 'بدأت اللعبة بالفعل ولا يمكن الانضمام الآن' }, 409)
      const count = await pool.query('SELECT COUNT(*)::int AS count FROM game_players WHERE room_id = $1', [room.id])
      if (count.rows[0].count >= 15) return json({ message: 'الغرفة مكتملة — الحد الأقصى 15 لاعباً' }, 409)
      const player = await pool.query('INSERT INTO game_players (room_id, display_name, team_name) VALUES ($1, $2, $3) RETURNING id', [room.id, displayName, teamName])
      return json({ roomCode, playerId: player.rows[0].id }, 201)
    }
    if (path[2] === 'ready' && method === 'POST') {
      const playerId = clean(body.playerId)
      await pool.query('UPDATE game_players SET is_ready = true WHERE id = $1 AND room_id = $2', [playerId, room.id])
      const players = await pool.query('SELECT id, is_ready FROM game_players WHERE room_id = $1', [room.id])
      if (players.rows.length >= 2 && players.rows.length <= 15 && players.rows.every((player) => player.is_ready)) await pool.query('UPDATE game_rooms SET status = $1, phase = $2, round = 1, current_player_id = $3 WHERE id = $4', ['playing', 'question', players.rows[0].id, room.id])
      return json({ ok: true })
    }
    return json({ message: 'العملية غير موجودة' }, 404)
  } catch (error) {
    console.error('[v0] online room API error', error)
    return json({ message: 'حدث خطأ في الخادم. حاول مرة أخرى.' }, 500)
  }
}

export const GET = handler
export const POST = handler
