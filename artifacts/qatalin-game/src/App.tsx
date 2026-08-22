'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Check, CircleHelp, Crosshair, Eye, FileWarning, Flag, LogOut, RotateCcw, Shield, Skull, Target, UserRound, UsersRound } from 'lucide-react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ErrorBoundary } from '@/components/error-boundary';
import { Toaster } from '@/components/ui/toaster';
import { TooltipProvider } from '@/components/ui/tooltip';
import NotFound from '@/legacy/not-found';
import { Route, Switch, useLocation, Router as WouterRouter } from 'wouter';
const referenceArtwork = '/game-artwork.jpg';

type Screen = 'intro' | 'room' | 'local-setup' | 'teams' | 'game';
type Phase = 'question' | 'target' | 'reveal' | 'assassination' | 'ending';
type Footballer = { name: string; isBoss: boolean; status: 'active' | 'excluded' | 'assassinated'; revealed: boolean };
type Team = { owner: string; footballers: Footballer[] };
type HistoryItem = { round: number; attacker: string; target: string; action: 'exclude' | 'assassinate' };
type GameState = { version: 2; screen: Screen; phase: Phase; playerCount: number; owners: string[]; teams: Team[]; setupIndex: number; round: number; turn: number; targetTeam: number | null; targetPlayer: number | null; exclusionTargets: number[]; revealDecision: 'choose' | 'exclude' | 'assassinate'; revealSourcePlayer: number | null; notes: string; winner: number | null; history: HistoryItem[]; onlineRoomCode?: string; onlinePlayerId?: string };

const queryClient = new QueryClient();
const STORAGE_KEY = 'qatalin-football-gangs-v2';
const ownerDefaults = ['أحمد', 'محمد', 'كريم', 'عمر', 'يوسف', 'زياد'];
const footballDefaults = ['محمد صلاح', 'ليونيل ميسي', 'كريستيانو رونالدو', 'كيليان مبابي', 'إيرلينغ هالاند', 'لوكا مودريتش', 'كيفن دي بروين', 'فينيسيوس جونيور', 'جود بيلينغهام', 'رودري'];
const helperCards = {
  'double-shot': { name: 'شك مضاعف', detail: 'بدلاً من اغتيال لاعب واحد، يمكنك اغتيال لاعبين في نفس الدور.' },
  silencer: { name: 'إسكات الخصم', detail: 'يلغي سؤال الخصم في هذا الدور ويبدأ الخصم مباشرة بمرحلة الاغتيال.' },
  shield: { name: 'درع الحماية', detail: 'إذا اختار الخصم زعيم فريقك، يتم إنقاذه وتستمر الحماية لدور واحد فقط.' },
  informant: { name: 'مخبر سري', detail: 'تحصل على معلومة مؤكدة عن أحد زعماء العصابة عند الخصم.' },
  swap: { name: 'تبديل', detail: 'تنقل صفة زعيم العصابة إلى لاعب آخر في فريقك دون كشف هويتك.' },
  camera: { name: 'كاميرا مراقبة', detail: 'تكشف توزيع زعماء العصابة داخل قائمة الخصم.' },
} as const;
const helperCardKeys = Object.keys(helperCards) as Array<keyof typeof helperCards>;
const questions = [
  'أي لاعب في فريق خصمك يحاول توجيه الشك بعيداً عنه؟ ولماذا؟',
  'لو كان عليك كشف لاعب واحد الآن، من تختار وما دليلك؟',
  'أي إجابة بدت محسوبة أكثر من اللازم في الجولة السابقة؟',
  'من تتوقع أنه يحمي زعيم العصابة دون أن يقصد؟',
  'ما الحركة التي فضحت ترتيب القوة داخل فريق الخصم؟',
  'من اللاعب الذي تغيّر أسلوب دفاعه عندما اقترب الاتهام منه؟',
];

const emptyFootballers = () => footballDefaults.map((name) => ({ name, isBoss: false, status: 'active' as const, revealed: false }));
const initialState = (): GameState => ({ version: 2, screen: 'intro', phase: 'question', playerCount: 2, owners: ownerDefaults.slice(0, 2), teams: [], setupIndex: 0, round: 1, turn: 0, targetTeam: null, targetPlayer: null, exclusionTargets: [], revealDecision: 'choose', revealSourcePlayer: null, notes: '', winner: null, history: [] });
function readSavedGame(): GameState { try { const saved = JSON.parse(window.localStorage.getItem(STORAGE_KEY) ?? 'null'); return saved?.version === 2 ? { ...saved, exclusionTargets: saved.exclusionTargets ?? [], revealDecision: saved.revealDecision ?? 'choose', revealSourcePlayer: saved.revealSourcePlayer ?? null } : initialState(); } catch { return initialState(); } }

function App() {
  const [game, setGame] = useState<GameState>(readSavedGame);
  const [draft, setDraft] = useState<Footballer[]>(emptyFootballers);
  const [showRules, setShowRules] = useState(false);
  useEffect(() => { window.localStorage.setItem(STORAGE_KEY, JSON.stringify(game)); }, [game]);
  const update = (changes: Partial<GameState>) => setGame((current) => ({ ...current, ...changes }));
  const setCount = (count: number) => update({ playerCount: count, owners: Array.from({ length: count }, (_, i) => game.owners[i] ?? ownerDefaults[i] ?? `لاعب ${i + 1}`) });
  const beginTeams = () => update({ screen: 'teams', setupIndex: 0, teams: [] });
  const saveTeam = () => {
    const cleaned = draft.map((player, index) => ({ ...player, name: player.name.trim() || `لاعب كرة ${index + 1}` }));
    const teams = [...game.teams, { owner: game.owners[game.setupIndex], footballers: cleaned }];
    if (game.onlineRoomCode && game.onlinePlayerId) {
      void fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/rooms/${game.onlineRoomCode}/roster`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ playerId: game.onlinePlayerId, roster: cleaned }) });
    }
    if (game.setupIndex === game.playerCount - 1) setGame({ ...game, screen: 'game', phase: 'question', teams, setupIndex: 0, round: 1, turn: 0, targetTeam: null, targetPlayer: null, winner: null, history: [] });
    else { update({ teams, setupIndex: game.setupIndex + 1 }); setDraft(emptyFootballers()); }
  };
  const reset = () => { if (window.confirm('هل تريد بدء غرفة جديدة؟ سيتم مسح تقدم الغرفة الحالية.')) { window.localStorage.removeItem(STORAGE_KEY); setGame(initialState()); setDraft(emptyFootballers()); } };
  const exit = () => { if (window.confirm('هل تريد الخروج والعودة إلى الصفحة الرئيسية؟')) { window.localStorage.removeItem(STORAGE_KEY); setGame(initialState()); setDraft(emptyFootballers()); } };
  return <div className="game-shell" dir="rtl"><div className="frame">
    <header className="topbar"><div className="brand-lockup"><div className="brand-mark"><Crosshair size={19} /></div><div><span className="brand-name">عصابة الملاعب</span><span className="brand-sub">ملف الزعماء السري</span></div></div><div className="topbar-actions"><button className="utility-button" onClick={() => setShowRules(true)}><FileWarning size={15} /> قواعد اللعبة</button>{game.screen !== 'intro' && <button className="utility-button exit-button" onClick={exit}><LogOut size={15} /> خروج</button>}</div></header>
    <AnimatePresence mode="wait">
      {game.screen === 'intro' && <IntroView onStart={() => update({ screen: 'room' })} onLocal={() => update({ screen: 'local-setup', onlineRoomCode: undefined, onlinePlayerId: undefined, teams: [], setupIndex: 0, round: 1, turn: 0, winner: null, history: [] })} onRules={() => setShowRules(true)} />}
      {game.screen === 'room' && <RoomSetup game={game} setCount={setCount} update={update} onBack={() => update({ screen: 'intro' })} onContinue={beginTeams} />}
      {game.screen === 'local-setup' && <LocalSetup game={game} setCount={setCount} update={update} onBack={() => update({ screen: 'intro' })} onContinue={beginTeams} />}
      {game.screen === 'teams' && <TeamSetup game={game} draft={draft} setDraft={setDraft} onSave={saveTeam} onBack={() => game.setupIndex === 0 ? update({ screen: 'room' }) : undefined} />}
      {game.screen === 'game' && <GameView game={game} setGame={setGame} onReset={reset} />}
    </AnimatePresence>
    <footer className="footer-note">عصابة الملاعب — اكشف الزعيم قبل أن يختفي الدليل</footer>
  </div>{showRules && <RulesModal onClose={() => setShowRules(false)} />}</div>;
}

function IntroView({ onStart, onLocal, onRules }: { onStart: () => void; onLocal: () => void; onRules: () => void }) {
  return <motion.main className="intro-page" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><section className="hero"><div className="hero-copy"><div className="eyebrow">مواجهة فرق — سري للغاية</div><h1 className="hero-title">عصابة<em>الملاعب</em></h1><p className="hero-lede">كل لاعب يبني فريقاً من 10 نجوم كرة قدم ويخفي بينهم زعيمين للعصابة. اسأل، راقب، ثم اكشف فريق خصمك واستبعد رجاله أو اغتل زعماءه.</p><div className="hero-actions"><button className="primary-button" onClick={onStart}>أنشئ غرفة أونلاين <ArrowLeft size={17} /></button><button className="secondary-button" onClick={onLocal}>تجربة محلية <UsersRound size={17} /></button><button className="ghost-button" onClick={onRules}>كيف نلعب؟ <CircleHelp size={17} /></button></div><div className="hero-note"><UsersRound size={14} /> من 2 إلى 15 لاعباً حقيقياً · 10 نجوم لكل فريق</div></div><div className="hero-art"><img src={referenceArtwork} alt="ملف عصابة الملاعب الفني" /><div className="art-stamp">تشكيلة سرية / ممنوع الكشف</div></div></section><section className="intro-rules"><div className="eyebrow">خطة المواجهة</div><h2 className="section-title">كوّن فريقك. أخفِ زعماءك.</h2><div className="rules-grid">{[['01','ابنِ التشكيلة','سمّ 10 لاعبي كرة في فريقك وحدد اثنين فقط كزعيمي العصابة.'],['02','حقق مع الخصم','في دورك ناقش سؤال الجولة ثم اختر لاعباً من فريق خصمك لكشفه.'],['03','احسم المصير','استبعد اللاعب العادي، وإذا اكتشفت زعيماً افتح أمر الاغتيال.']].map(([n,t,b]) => <article className="rule-card" key={n}><div className="rule-number">{n}</div><h3>{t}</h3><p>{b}</p></article>)}</div></section></motion.main>;
}

function LocalSetup({ game, setCount, update, onBack, onContinue }: { game: GameState; setCount: (n:number)=>void; update:(c:Partial<GameState>)=>void; onBack:()=>void; onContinue:()=>void }) {
  return <motion.main className="setup-wrap local-setup-page" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}}><div className="eyebrow">إعداد سريع</div><div className="game-header"><div><h1>تجربة محلية</h1><p className="section-desc">للتجربة على جهاز واحد، من 2 إلى 15 لاعباً.</p></div><UsersRound /></div><section className="paper-card local-card"><div className="card-heading"><div><h2>عدد اللاعبين</h2><p>اختر عدد المشاركين ثم اكتب أسماءهم.</p></div><UsersRound /></div><div className="count-grid compact">{Array.from({length:14},(_,i)=>i+2).map(count=><button key={count} className={`count-button ${game.playerCount===count?'active':''}`} onClick={()=>setCount(count)}>{count}</button>)}</div><div className="local-names">{game.owners.map((owner,index)=><label className="name-field" key={index}><span className="name-index">{index+1}</span><input className="text-input" value={owner} onChange={e=>update({owners:game.owners.map((name,i)=>i===index?e.target.value:name)})} placeholder={`اسم اللاعب ${index+1}`} /></label>)}</div><div className="setup-footer local-footer"><button className="utility-button" onClick={onBack}><ArrowRight /> رجوع</button><button className="primary-button" onClick={onContinue} disabled={game.owners.some(name=>!name.trim())}>تجهيز الفرق <ArrowLeft /></button></div></section></motion.main>;
}

function RoomSetup({ game, setCount, update, onBack, onContinue }: { game: GameState; setCount: (n:number)=>void; update:(c:Partial<GameState>)=>void; onBack:()=>void; onContinue:()=>void }) {
  const [name, setName] = useState(game.owners[0] ?? '');
  const [teamName, setTeamName] = useState('فريق الظلال');
  const [roomCode, setRoomCode] = useState('');
  const [onlineCode, setOnlineCode] = useState('');
  const [playerId, setPlayerId] = useState('');
  const [onlinePlayers, setOnlinePlayers] = useState<{displayName:string;teamName:string;isReady:boolean}[]>([]);
  const [onlineMode, setOnlineMode] = useState<'idle'|'lobby'>('idle');
  const [onlineError, setOnlineError] = useState('');
  const api = (process.env.NEXT_PUBLIC_API_URL ?? '/api').replace(/\/$/, '');
  const requestJson = async (url: string, init?: RequestInit) => {
    const response = await fetch(url, { ...init, headers: { 'content-type': 'application/json', ...(init?.headers ?? {}) } });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.message ?? 'تعذر الاتصال بالخادم');
    return data;
  };
  const createRoom = async () => { setOnlineError(''); try { const data = await requestJson(`${api}/rooms`, { method:'POST', body:JSON.stringify({displayName:name.trim(),teamName:teamName.trim()}) }); setRoomCode(data.roomCode); setPlayerId(data.playerId); update({ onlineRoomCode: data.roomCode, onlinePlayerId: data.playerId }); setOnlineMode('lobby'); } catch (error) { setOnlineError(error instanceof Error ? error.message : 'تعذر إنشاء الغرفة'); } };
  const joinRoom = async () => { setOnlineError(''); const normalizedCode = onlineCode.trim().toUpperCase(); if (!/^[A-Z0-9]{6}$/.test(normalizedCode)) return setOnlineError('اكتب كود غرفة صحيحاً من 6 أحرف'); try { const data = await requestJson(`${api}/rooms/${normalizedCode}/join`, { method:'POST', body:JSON.stringify({displayName:name.trim(),teamName:teamName.trim()}) }); setRoomCode(data.roomCode); setPlayerId(data.playerId); update({ onlineRoomCode: data.roomCode, onlinePlayerId: data.playerId }); setOnlineMode('lobby'); } catch (error) { setOnlineError(error instanceof Error ? error.message : 'تعذر الانضمام'); } };
  useEffect(() => { if(onlineMode !== 'lobby' || !roomCode) return; let active = true; const load = async () => { try { const data = await requestJson(`${api}/rooms/${roomCode}`); if (active) setOnlinePlayers(data.players ?? []); } catch (error) { if (active) setOnlineError(error instanceof Error ? error.message : 'تعذر تحديث الغرفة'); } }; void load(); const timer=window.setInterval(load, 2500); return () => { active = false; window.clearInterval(timer); }; }, [api, onlineMode, roomCode]);
  const ready = async () => { setOnlineError(''); try { await requestJson(`${api}/rooms/${roomCode}/ready`, {method:'POST',body:JSON.stringify({playerId})}); update({ onlineRoomCode: roomCode, onlinePlayerId: playerId, playerCount: Math.max(game.playerCount, onlinePlayers.length) }); onContinue(); } catch (error) { setOnlineError(error instanceof Error ? error.message : 'تعذر تسجيل الجاهزية'); } };
  return <motion.main className="setup-wrap" initial={{opacity:0,x:20}} animate={{opacity:1,x:0}}><div className="eyebrow">الخطوة الأولى</div><div className="game-header"><h1>{onlineMode==='lobby'?'الغرفة جاهزة':'من في الغرفة؟'}</h1><div className="round-marker"><strong>{onlineMode==='lobby'?roomCode:game.playerCount}</strong> {onlineMode==='lobby'?'كود الغرفة':'لاعبين محليين'}</div></div>{onlineMode==='lobby'?<section className="paper-card online-lobby"><div className="card-heading"><div><h2>غرفة {roomCode}</h2><p>شارك الكود مع أصدقائك. الق��ئمة تتحدث تلقائياً.</p></div><UsersRound /></div><div className="room-code-display">{roomCode}</div><div className="online-player-list">{onlinePlayers.map((player,i)=><div className="player-row" key={`${player.displayName}-${i}`}><span>{player.displayName} — {player.teamName}</span><span className="status-tag alive">{player.isReady?'جاهز':'ينتظر'}</span></div>)}</div><div className="setup-footer"><button className="utility-button" onClick={()=>setOnlineMode('idle')}><ArrowRight /> رجوع</button><button className="primary-button" onClick={ready}>أنا جاهز <Check /></button></div></section>:<div className="setup-layout"><section className="paper-card"><div className="card-heading"><div><h2>لعب أونلاين</h2><p>أنشئ غرفة أو انضم بكود.</p></div><Crosshair /></div><label className="name-field"><span className="name-index">اسمك</span><input className="text-input" value={name} onChange={e=>setName(e.target.value)} placeholder="مثال: كريم" /></label><label className="name-field"><span className="name-index">فريقك</span><input className="text-input" value={teamName} onChange={e=>setTeamName(e.target.value)} /></label><div className="setup-footer"><button className="primary-button" onClick={createRoom} disabled={!name.trim()}>أنشئ غرفة <ArrowLeft /></button></div><div className="join-row"><input className="text-input" value={onlineCode} onChange={e=>setOnlineCode(e.target.value.toUpperCase())} placeholder="كود الغرفة" /><button className="ghost-button" onClick={joinRoom} disabled={!name.trim()||onlineCode.length<4}>انضم</button></div>{onlineError&&<p className="error-copy">{onlineError}</p>}</section><section className="paper-card"><div className="card-heading"><div><h2>تجربة محلية</h2><p>للتجربة على جهاز واحد، جهّز من 2 إلى 6 فرق.</p></div><UsersRound /></div><div className="count-grid compact">{Array.from({ length: 14 }, (_, i) => i + 2).map(n => <button key={n} className={`count-button ${game.playerCount===n?'selected':''}`} onClick={()=>setCount(n)}>{n}</button>)}</div><div className="name-list">{game.owners.map((owner,i)=><label className="name-field" key={i}><span className="name-index">{i+1}</span><input className="text-input" value={owner} onChange={e=>update({owners:game.owners.map((x,j)=>j===i?e.target.value:x)})} aria-label={`اسم اللاعب ${i+1}`} /></label>)}</div><div className="setup-footer"><button className="utility-button" onClick={onBack}><ArrowRight /> رجوع</button><button className="primary-button" onClick={onContinue} disabled={game.owners.some(n=>!n.trim())}>تجهيز ا��فرق <ArrowLeft /></button></div></section></div>}</motion.main>;
}

function TeamSetup({ game, draft, setDraft, onSave, onBack }: { game:GameState; draft:Footballer[]; setDraft:(d:Footballer[])=>void; onSave:()=>void; onBack:()=>void }) {
  const bossCount = draft.filter(p=>p.isBoss).length;
  const toggleBoss = (i:number) => { if (!draft[i].isBoss && bossCount >= 2) return; setDraft(draft.map((p,j)=>j===i?{...p,isBoss:!p.isBoss}:p)); };
  return <motion.main className="setup-wrap" initial={{opacity:0}} animate={{opacity:1}}><div className="eyebrow">تجهيز الفريق {game.setupIndex+1} من {game.playerCount}</div><div className="game-header"><div><h1>تشكيلة {game.owners[game.setupIndex]}</h1><p className="section-desc">مرّر الجهاز لصاحب الفريق فقط. اختيارات الزعماء سرية.</p></div><div className="round-marker"><strong>{bossCount}/2</strong> زعماء محددون</div></div><section className="paper-card"><div className="card-heading"><div><h2>قائمة الـ10 لاعبين</h2><p>عدّل الأسماء واضغط على تاج الزعيم بجوار لاعبين فقط.</p></div><Shield /></div><div className="squad-grid">{draft.map((player,i)=><div className={`squad-edit ${player.isBoss?'boss-picked':''}`} key={i}><span className="player-number">{String(i+1).padStart(2,'0')}</span><input className="text-input" value={player.name} onChange={e=>setDraft(draft.map((p,j)=>j===i?{...p,name:e.target.value}:p))} aria-label={`اسم لاعب الكرة ${i+1}`} /><button className="boss-toggle" onClick={()=>toggleBoss(i)} aria-pressed={player.isBoss}>{player.isBoss?<Check />:<Shield />}<span>{player.isBoss?'زعيم':'تحديد'}</span></button></div>)}</div><div className="privacy-callout"><Eye /> <span>لا تعرض هذه الشاشة للخصوم. لن تظهر هوية الزعيم إلا بعد اتهامه.</span></div><div className="setup-footer"><button className="utility-button" onClick={onBack} disabled={game.setupIndex>0}><ArrowRight /> العودة</button><button className="primary-button" onClick={onSave} disabled={bossCount!==2 || draft.some(p=>!p.name.trim())}>{game.setupIndex===game.playerCount-1?'ابدأ المواجهة':'احفظ ومرّر الجهاز'} <ArrowLeft /></button></div></section></motion.main>;
}

function GameView({ game, setGame, onReset }: { game:GameState; setGame:(g:GameState)=>void; onReset:()=>void }) {
  const attacker = game.teams[game.turn];
  const currentQuestion = questions[(game.round-1)%questions.length];
  const [cards, setCards] = useState<{id:string;cardType:keyof typeof helperCards;usedAt:string|null}[]>(() => helperCardKeys.sort(() => Math.random() - 0.5).slice(0, 3).map((cardType, index) => ({ id: `local-${index}`, cardType, usedAt: null })));
  const [openedCard, setOpenedCard] = useState<keyof typeof helperCards | null>(null);
  useEffect(() => { if (!game.onlineRoomCode || !game.onlinePlayerId) return; const loadCards = async () => { const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/rooms/${game.onlineRoomCode}/cards/${game.onlinePlayerId}`); if (response.ok) setCards((await response.json()).cards); }; void loadCards(); }, [game.onlineRoomCode, game.onlinePlayerId]);
  const useCard = async (id:string) => { const card = cards.find(item => item.id === id); if (!card || card.usedAt) return; if (game.onlineRoomCode && game.onlinePlayerId) { const response = await fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/rooms/${game.onlineRoomCode}/cards/${id}/use`, { method:'POST', headers:{'content-type':'application/json'}, body:JSON.stringify({playerId:game.onlinePlayerId}) }); if (!response.ok) return; } setCards(current => current.map(item => item.id === id ? {...item, usedAt:new Date().toISOString()} : item)); setOpenedCard(card.cardType); };
  const validTeams = game.teams.map((t,i)=>({t,i})).filter(({t,i})=>i!==game.turn && t.footballers.some(p=>p.status==='active'));
  const selected = game.targetTeam!==null && game.targetPlayer!==null ? game.teams[game.targetTeam].footballers[game.targetPlayer] : null;
  const update = (c:Partial<GameState>) => setGame({...game,...c});
  const syncEvent = (eventType: string, targetId?: string) => { if (!game.onlineRoomCode || !game.onlinePlayerId) return; void fetch(`${process.env.NEXT_PUBLIC_API_URL ?? '/api'}/rooms/${game.onlineRoomCode}/events`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ actorId: game.onlinePlayerId, targetId, eventType, payload: { round: game.round } }) }); };
  const reveal = () => { if (game.targetTeam===null || game.targetPlayer===null) return; const teams=game.teams.map((t,ti)=>ti===game.targetTeam?{...t,footballers:t.footballers.map((p,pi)=>pi===game.targetPlayer?{...p,revealed:true}:p)}:t); syncEvent('reveal', selected?.name); setGame({...game,teams,phase:'reveal',revealDecision:'choose',revealSourcePlayer:game.targetPlayer,exclusionTargets:[]}); };
  const chooseRevealDecision = (decision:'exclude'|'assassinate') => { if (!selected?.isBoss || !selected.revealed) return; if (decision === 'assassinate') { update({ revealDecision: decision, phase: 'assassination', targetPlayer: null }); return; } update({ revealDecision: decision, exclusionTargets: [] }); };
  const act = (action:'exclude'|'assassinate') => {
    if (game.targetTeam === null || game.targetPlayer === null || !selected) return;
    if (action === 'assassinate' && (game.phase !== 'assassination' || selected.status !== 'active')) return;
    if (game.phase === 'assassination' && game.targetPlayer === game.revealSourcePlayer) return;
    const sourceIndex = game.revealSourcePlayer;
    const isSecondChoice = game.phase === 'assassination' && sourceIndex !== null;
    const source = sourceIndex === null ? null : game.teams[game.targetTeam].footballers[sourceIndex];
    if (isSecondChoice && (!source || source.status !== 'active')) return;
    syncEvent(action, selected.name);
    const status: Footballer['status'] = action === 'assassinate' ? 'assassinated' : 'excluded';
    let statusByIndex = new Map<number, Footballer['status']>();
    let targets: number[];
    if (isSecondChoice) {
      // كشف الزعيم يمنح نفس اللاعب اختياراً ثانياً من الفريق نفسه.
      // إذا كان الهدف عادياً، يُستبعد الهدف والزعيم المكتشف معاً.
      targets = sourceIndex === null ? [game.targetPlayer] : [sourceIndex, game.targetPlayer];
      // الزعيم المكتشف يُغتال دائماً. أما اللاعب الثاني فيُغتال إن كان زعيماً، ويُستبعد إن كان لاعباً عادياً.
      if (sourceIndex !== null) statusByIndex.set(sourceIndex, 'assassinated');
      statusByIndex.set(game.targetPlayer, selected.isBoss ? 'assassinated' : 'excluded');
    } else {
      targets = action === 'exclude' && selected.isBoss && selected.revealed ? game.exclusionTargets : [game.targetPlayer];
      if (action === 'exclude' && selected.isBoss && selected.revealed && targets.length !== 2) return;
      targets.forEach(index => statusByIndex.set(index, status));
    }
    const teams = game.teams.map((team, teamIndex) => teamIndex === game.targetTeam ? { ...team, footballers: team.footballers.map((player, index) => statusByIndex.has(index) ? { ...player, status: statusByIndex.get(index)! } : player) } : team);
    const aliveTeams = teams.map((team, index) => ({ index, alive: team.footballers.some(player => player.isBoss && player.status === 'active') })).filter(item => item.alive);
    const history = [...game.history, ...targets.map(targetIndex => ({ round: game.round, attacker: attacker.owner, target: `${game.teams[game.targetTeam!].footballers[targetIndex].name} — ${game.teams[game.targetTeam!].owner}`, action: targetIndex === sourceIndex && selected.isBoss ? 'assassinate' as const : action }))];
    if (aliveTeams.length <= 1) setGame({ ...game, teams, history, winner: aliveTeams[0]?.index ?? null, phase: 'ending' });
    else {
      let next = (game.turn + 1) % teams.length;
      while (!aliveTeams.some(item => item.index === next)) next = (next + 1) % teams.length;
      setGame({ ...game, teams, history, turn: next, round: game.round + 1, phase: 'question', targetTeam: null, targetPlayer: null, exclusionTargets: [], revealSourcePlayer: null, revealDecision: 'choose', notes: '' });
    }
  };
  const toggleExclusionTarget = (playerIndex:number) => {
    if(game.targetTeam===null) return;
    const player = game.teams[game.targetTeam].footballers[playerIndex];
    if(!player || player.status !== 'active' || player.isBoss) return;
    const next = game.exclusionTargets.includes(playerIndex) ? game.exclusionTargets.filter(index=>index!==playerIndex) : game.exclusionTargets.length < 2 ? [...game.exclusionTargets, playerIndex] : game.exclusionTargets;
    update({ exclusionTargets: next });
  };
  if(game.phase==='ending') return <EndingView game={game} onReset={onReset}/>;
  return <motion.main className="game-wrap" initial={{opacity:0}} animate={{opacity:1}}><div className="game-header"><div><div className="eyebrow">دور {attacker.owner}</div><h1>{game.phase==='question'?'غرفة التحقيق':game.phase==='target'?'حدد هدفك':game.phase==='assassination'?'اختر لاعباً للاغتيال':'تم كشف الهوية'}</h1></div><div className="round-marker"><strong>{game.round}</strong> الجولة الحالية</div></div><div className="turn-banner"><Target /><div><strong>{attacker.owner} يهاجم الآن</strong><span>اختر لاعباً من فريق خصمك. لا يمكنك استهداف فريقك.</span></div></div><div className="phase-layout"><section className="paper-card phase-card">
    {game.phase==='question'&&<><div className="phase-icon"><CircleHelp /></div><h2>سؤال الجولة</h2><p className="large-copy">ناقش السؤال مع خصومك وابحث عن أي دفاع يكشف ترتيب العصابة.</p><div className="question-quote">« {currentQuestion} »</div><textarea className="answer-box" value={game.notes} onChange={e=>update({notes:e.target.value})} placeholder="دوّن ملاحظاتك عن الإجابات..."/><button className="primary-button action-gap" onClick={()=>update({phase:'target'})}>ابدأ الكشف <ArrowLeft /></button></>}
    {game.phase==='target'&&<><div className="phase-icon"><Crosshair /></div><h2>اختر فريق الخصم</h2><div className="opponent-tabs">{validTeams.map(({t,i})=><button key={i} className={`opponent-tab ${game.targetTeam===i?'selected':''}`} onClick={()=>update({targetTeam:i,targetPlayer:null})}>{t.owner}<span>{t.footballers.filter(p=>p.status==='active').length} متاح</span></button>)}</div>{game.targetTeam!==null&&<div className="footballer-grid">{game.teams[game.targetTeam].footballers.map((p,i)=><button key={i} disabled={p.status!=='active'} className={`footballer-card ${game.targetPlayer===i?'selected':''} ${p.status!=='active'?'out':''}`} onClick={()=>update({targetPlayer:i})}><UserRound /><strong>{p.name}</strong><span>{p.status==='active'?(p.revealed&&p.isBoss?'زعيم مكشوف':'متاح'):p.status==='assassinated'?'تم اغتياله':'مستبعد'}</span></button>)}</div>}<button className="primary-button action-gap" disabled={game.targetPlayer===null} onClick={reveal}>اكشف الهوية <Eye /></button></>}
    {game.phase==='assassination'&&game.targetTeam!==null&&<><div className="phase-icon"><Crosshair /></div><h2>اغتيال لاعب آخر</h2><p className="large-copy">اختر لاعباً آخر من نفس قائمة الخصم. يظهر الزعيمان ضمن القائمة بشكل طبيعي.</p><div className="footballer-grid">{game.teams[game.targetTeam].footballers.map((p,i)=><button key={i} disabled={p.status!=='active'||i===game.revealSourcePlayer} className={`footballer-card ${game.targetPlayer===i?'selected':''} ${p.status!=='active'||i===game.revealSourcePlayer?'out':''}`} onClick={()=>update({targetPlayer:i})}><UserRound /><strong>{p.name}</strong><span>{i===game.revealSourcePlayer?'تم كشفه':p.status==='active'?'متاح':p.status==='assassinated'?'تم اغتياله':'مستبعد'}</span></button>)}</div><button className="danger-button action-gap" disabled={game.targetPlayer===null} onClick={()=>act('assassinate')}><Crosshair /> تأكيد الاغتيال</button></>}
    {game.phase==='reveal'&&selected&&<><div className={`reveal-result ${selected.isBoss?'is-boss':''}`}><div className="result-symbol">{selected.isBoss?<Skull />:<UserRound />}</div><span>تم كشف</span><h2>{selected.name}</h2><strong>{selected.isBoss?'زعيم عصابة':'لاعب عادي'}</strong><p>{selected.isBoss?'تم كشف زعيم الخصم. قبل اختيار أي لاعب، حدّد قرارك أولاً: الاستبعاد أو الاغتيال المباشر.':'ليس زعيماً. يمكنك استبعاده من قائمة الخصم.'}</p></div><div className="decision-actions">{selected.isBoss?game.revealDecision==='choose'?<div className="reveal-choice"><strong>هل تريد استبعاد لاعب��ن أم الاغتيال مباشرة؟</strong><div className="reveal-choice-actions"><button className="primary-button" onClick={()=>chooseRevealDecision('exclude')}><UserRound /> استبعاد لاعبين</button><button className="danger-button" onClick={()=>chooseRevealDecision('assassinate')}><Crosshair /> اغتيال مباشر</button></div></div>:game.revealDecision==='exclude'?<><div className="exclusion-picker"><strong>اختر لاعبين للاستبعاد: {game.exclusionTargets.length}/2</strong><div className="footballer-grid compact-grid">{game.teams[game.targetTeam!].footballers.map((player,index)=>player.status==='active'&&!player.isBoss&&<button key={index} className={`footballer-card ${game.exclusionTargets.includes(index)?'selected':''}`} onClick={()=>toggleExclusionTarget(index)}><UserRound /><strong>{player.name}</strong><span>{game.exclusionTargets.includes(index)?'سيتم استبعاده':'اختيار'}</span></button>)}</div></div><button className="primary-button" disabled={game.exclusionTargets.length!==2} onClick={()=>act('exclude')}><UserRound /> تأكيد استبعاد لاعبين</button></>:null:<button className="primary-button" onClick={()=>act('exclude')}><UserRound /> استبعاد اللاعب</button>}</div></>}
  </section><aside className="game-sidebar"><TeamStatus teams={game.teams} turn={game.turn} history={game.history} onReset={onReset}/>{cards.length > 0 && <section className="paper-card cards-panel"><div className="card-heading"><div><h2>كروت المساعدة</h2><p>اسحب كرتاً عشوائياً واستخدمه في أي جولة.</p></div><Shield /></div><img className="cards-reference" src="/images/helper-cards-reference.jpg" alt="نماذج كروت المساعدة" /><div className="card-list">{cards.map(card => <button className="helper-card-row" key={card.id} disabled={Boolean(card.usedAt)} onClick={() => useCard(card.id)}><span><strong>{helperCards[card.cardType].name}</strong><small>{helperCards[card.cardType].detail}</small></span><span className="status-tag target">{card.usedAt?'مستخدم':'استخدم'}</span></button>)}</div>{openedCard && <div className="card-detail"><strong>{helperCards[openedCard].name}</strong><p>{helperCards[openedCard].detail}</p><button className="utility-button" onClick={() => setOpenedCard(null)}>إغلاق</button></div>}</section>}</aside></div></motion.main>;
}

function TeamStatus({teams,turn,history,onReset}:{teams:Team[];turn:number;history:HistoryItem[];onReset:()=>void}) { return <aside className="paper-card players-card"><div className="card-heading"><div><h2>حالة الفرق</h2><p>سجل القوة المتبقية.</p></div><Flag /></div><div className="team-status-list">{teams.map((team,i)=>{const bosses=team.footballers.filter(p=>p.isBoss&&p.status!=='assassinated').length;return <div className={`team-status ${i===turn?'current':''}`} key={i}><div><strong>{team.owner}</strong><span>{team.footballers.filter(p=>p.status==='active').length} لاعبين متاحين</span></div><div className="boss-lives"><Skull /> {bosses}/2</div></div>})}</div>{history.length>0&&<div className="history-panel"><h3>آخر العمليات</h3>{history.slice(-3).reverse().map((h,i)=><p key={i}><strong>{h.attacker}</strong> {h.action==='assassinate'?'اغتال':'استبعد'} {h.target}</p>)}</div>}<button className="utility-button action-gap" onClick={onReset}><RotateCcw /> غرفة جديدة</button></aside> }

function EndingView({game,onReset}:{game:GameState;onReset:()=>void}) { const winner=game.winner===null?null:game.teams[game.winner]; return <motion.main className="game-wrap" initial={{opacity:0}} animate={{opacity:1}}><section className="paper-card result-hero"><div className="result-symbol"><Shield /></div><div className="eyebrow centered">انتهت المواجهة</div><h1>فريق {winner?.owner} انتصر</h1><p>بقي لهذا الفريق زعيم واحد على الأقل، بينما تم اغتيال زعماء كل الفرق المنافسة.</p><div className="winner-squad">{winner?.footballers.filter(p=>p.isBoss).map(p=><div className="player-row" key={p.name}><span>{p.name}</span><span className="status-tag target">{p.status==='assassinated'?'مغتال':'زعيم ناجٍ'}</span></div>)}</div><button className="primary-button" onClick={onReset}><RotateCcw /> افتح غرفة جديدة</button></section></motion.main> }

function RulesModal({onClose}:{onClose:()=>void}) { return <motion.div className="modal-backdrop" initial={{opacity:0}} animate={{opacity:1}} onClick={onClose}><motion.div className="paper-card rules-modal" role="dialog" aria-modal="true" aria-labelledby="rules-title" onClick={e=>e.stopPropagation()}><div className="card-heading"><div><div className="eyebrow">دليل اللعب</div><h2 id="rules-title">قواعد عصابة الملاعب</h2></div><button className="utility-button" onClick={onClose}>إغلاق</button></div><ol className="modal-list"><li><strong>كل لاعب حقيقي</strong> ينشئ فريقاً مستقلاً من 10 لاعبي كرة.</li><li>يختار صاحب الفريق <strong>زعيمين فقط</strong> يظلان سريين.</li><li>في كل جولة يجيب اللاعبون عن سؤال، ثم يختار صاحب الدور هدفاً من فريق خصم.</li><li>يتم كشف هوية الهدف: اللاعب العادي يُستبعد، والزعيم المكشوف يمكن اغتياله.</li><li>يفوز آخر فريق يبقى لديه زعيم عصابة حي.</li></ol></motion.div></motion.div> }

function Router(){return <RoutedErrorBoundary><Switch><Route path="/" component={Home}/><Route component={NotFound}/></Switch></RoutedErrorBoundary>}
function Home(){return <App/>}
function RoutedErrorBoundary({children}:{children:ReactNode}){const[location]=useLocation();return <ErrorBoundary resetKey={location}>{children}</ErrorBoundary>}
function RootApp(){return <QueryClientProvider client={queryClient}><TooltipProvider><WouterRouter base={'/'}><Router/></WouterRouter><Toaster/></TooltipProvider></QueryClientProvider>}
export default RootApp;
