import assert from 'node:assert/strict'

const resolveTarget = (state, targetId) => state.teams.flatMap((team) => team.footballers).find((player) => player.id === targetId)
const applyEvent = (state, event) => {
  const next = structuredClone(state)
  const target = resolveTarget(next, event.targetId)
  assert.ok(target, 'target must exist')
  if (event.type === 'reveal') target.revealed = true
  if (event.type === 'exclude') target.status = 'excluded'
  if (event.type === 'assassinate') target.status = 'assassinated'
  return next
}

const state = { teams: [{ footballers: [{ id: 'p-1', isBoss: true, revealed: false, status: 'active' }] }, { footballers: [{ id: 'p-2', isBoss: false, revealed: false, status: 'active' }] }] }
const revealed = applyEvent(state, { type: 'reveal', targetId: 'p-1' })
assert.equal(revealed.teams[0].footballers[0].revealed, true)
assert.equal(revealed.teams[1].footballers[0].revealed, false)
const excluded = applyEvent(state, { type: 'exclude', targetId: 'p-2' })
assert.equal(excluded.teams[1].footballers[0].status, 'excluded')
assert.equal(state.teams[1].footballers[0].status, 'active')
console.log('game-state tests passed')
