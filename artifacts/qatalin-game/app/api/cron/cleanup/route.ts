import { NextResponse } from 'next/server'
import { Pool } from 'pg'
import { Signer } from '@aws-sdk/rds-signer'
import { awsCredentialsProvider } from '@vercel/functions/oidc'

export async function GET(request: Request) {
  if (request.headers.get('authorization') !== `Bearer ${process.env.CRON_SECRET}`) return NextResponse.json({ message: 'Unauthorized' }, { status: 401 })
  const signer = new Signer({ credentials: awsCredentialsProvider({ roleArn: process.env.AWS_ROLE_ARN, clientConfig: { region: process.env.AWS_REGION } }), region: process.env.AWS_REGION, hostname: process.env.PGHOST, username: process.env.PGUSER ?? 'postgres', port: Number(process.env.PGPORT ?? 5432) })
  const pool = new Pool({ host: process.env.PGHOST, port: Number(process.env.PGPORT ?? 5432), database: process.env.PGDATABASE ?? 'postgres', user: process.env.PGUSER ?? 'postgres', password: () => signer.getAuthToken(), ssl: { rejectUnauthorized: false }, max: 2 })
  try { const result = await pool.query("DELETE FROM game_rooms WHERE created_at < now() - interval '24 hours'"); return NextResponse.json({ ok: true, deleted: result.rowCount ?? 0 }) } finally { await pool.end() }
}
