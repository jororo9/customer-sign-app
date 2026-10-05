'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ManagerRow = {
  id: number
  branch: string
  team: string
  manager_name: string
  performance: number // 신청
  progress: number    // 진행
}

type PromoSettings = {
  title: string
  target1: number; target2: number; target3: number          // 구간별 신청 기준
  progress1: number; progress2: number; progress3: number    // 구간별 진행 기준 (0 = 조건 없음)
  reward1_text: string; reward2_text: string; reward3_text: string
  current_day: number; total_day: number
  cheer_messages?: string[]
}

type TierInfo = {
  applyTier: number      // 신청만 보고 넘은 깃발 (0~3)
  confirmedTier: number  // 신청 & 진행 모두 충족한 구간 (0~3)
  pending: boolean       // 깃발은 넘었는데 미확정 → 흐림 처리
}
type RankedManager = ManagerRow & TierInfo & { rank: number }

const defaultSettings: PromoSettings = {
  title: '상담매니저 초중 이벤트',
  target1: 5, target2: 10, target3: 15,
  progress1: 0, progress2: 0, progress3: 0,
  reward1_text: '1만원권', reward2_text: '2만원권', reward3_text: '3만원권',
  current_day: 3, total_day: 5,
  cheer_messages: ['조금만 더 힘내요', '거의 다 왔어요, 파이팅', '오늘도 달리는 중', '한 걸음만 더', '끝까지 힘내주세요'],
}

const CHEER_MESSAGES = [
  '조금만 더 힘내요',
  '거의 다 왔어요, 파이팅',
  '오늘도 달리는 중',
  '한 걸음만 더',
  '끝까지 힘내주세요',
]

// ---- 디자인 토큰 (해변 러닝 팔레트) ----
const T = {
  bg: '#EAF6FB',          // 연한 하늘
  card: 'rgba(255,255,255,0.58)',   // 반투명 글래스
  border: 'rgba(255,255,255,0.95)',
  shadow: '0 8px 24px -8px rgba(20,70,100,0.18)',
  radius: 20,
  radiusSm: 14,
  accent: '#1B8DB5',      // 바다
  accentDark: '#0F6A8A',
  accentSoft: '#DDF1F8',
  titleInk: '#0F4C68',
  textPrimary: '#16384A',
  textSecondary: '#4A6B7C',
  textMuted: '#8AA7B5',
  tier1: '#E8A33D',       // 햇살
  tier2: '#E2674A',       // 산호
  tier3: '#B83A72',       // 노을
  sea: '#4E9FC2',
  seaDeep: '#2F7FA6',
  foam: '#F4FAF8',
  sand: '#F3DFB2',
  sandLine: 'rgba(160,120,60,0.12)',
  sandDark: '#B08850',
}
// 하늘 → 모래로 내려오는 페이지 배경
const PAGE_BG = 'linear-gradient(180deg, #BFE4F4 0%, #DDF2FA 420px, #FFF6E6 100%)'
// 반투명 글래스 카드 공통 스타일
const GLASS: React.CSSProperties = {
  background: T.card,
  border: `1px solid ${T.border}`,
  boxShadow: T.shadow,
  backdropFilter: 'blur(10px)',
  WebkitBackdropFilter: 'blur(10px)',
}
const FONT = "'Pretendard', 'Inter', var(--font-noto-sans-kr), sans-serif"

function useCheer(messages: string[]) {
  const [idx, setIdx] = useState(0)
  useEffect(() => {
    setIdx(0)
    const t = setInterval(() => setIdx(i => (i + 1) % Math.max(messages.length, 1)), 3500)
    return () => clearInterval(t)
  }, [messages])
  return messages[idx] || ''
}

function normalizeTeam(team: string) {
  return (team || '').replace(/\s*T\s*$/, '').trim()
}
function isTeamLead(team: string) {
  return /T\s*$/.test((team || '').trim())
}
function seededRandom(seed: number) {
  const x = Math.sin(seed * 999) * 10000
  return x - Math.floor(x)
}
function tierColor(tier: number) {
  return tier === 3 ? T.tier3 : tier === 2 ? T.tier2 : tier === 1 ? T.tier1 : '#D6D3D1'
}
function toNum(v: unknown, fallback = 0) {
  if (v === null || v === undefined || v === '') return fallback
  const n = Number(v)
  return Number.isFinite(n) ? n : fallback
}

// ---- 구간 판정 ----
function tierList(s: PromoSettings) {
  return [
    { a: s.target1, p: s.progress1 || 0, reward: s.reward1_text },
    { a: s.target2, p: s.progress2 || 0, reward: s.reward2_text },
    { a: s.target3, p: s.progress3 || 0, reward: s.reward3_text },
  ]
}

// 신청으로 넘은 깃발(applyTier)과, 신청 & 진행을 모두 충족한 가장 높은 구간(confirmedTier)
function getTierInfo(m: { performance: number; progress: number }, s: PromoSettings): TierInfo {
  let applyTier = 0
  let confirmedTier = 0
  tierList(s).forEach((t, i) => {
    if (m.performance >= t.a) {
      applyTier = i + 1
      if (m.progress >= t.p) confirmedTier = i + 1
    }
  })
  return { applyTier, confirmedTier, pending: applyTier > 0 && confirmedTier === 0 }
}

function conditionText(a: number, p: number) {
  return p > 0 ? `신청 ${a}↑ · 진행 ${p}↑` : `신청 ${a}↑`
}
function statusText(m: TierInfo) {
  return m.confirmedTier > 0 ? `${m.confirmedTier}구간 확정` : '미확정'
}
function nextStepMessage(m: RankedManager, s: PromoSettings) {
  if (m.confirmedTier >= 3) return `3구간 확정! ${s.reward3_text} 획득`
  const next = tierList(s)[m.confirmedTier]
  const needA = Math.max(0, next.a - m.performance)
  const needP = Math.max(0, next.p - m.progress)
  const parts: string[] = []
  if (needA > 0) parts.push(`신청 ${needA}`)
  if (needP > 0) parts.push(`진행 ${needP}건`)
  const prefix = m.confirmedTier > 0 ? `${m.confirmedTier}구간 확정! ` : ''
  return `${prefix}${m.confirmedTier + 1}구간까지 ${parts.join(', ')} 남았어요`
}

// 러너 아이콘 (이모지, 오른쪽을 보도록 flip)
// - 확정 구간이 있으면 그 구간 색 테두리
// - 깃발은 넘었는데 미확정이면 흐리게
function RunnerIcon({ confirmedTier = 0, faded = false, size = 15 }: { confirmedTier?: number; faded?: boolean; size?: number }) {
  const ring = confirmedTier > 0
  const color = tierColor(confirmedTier)
  return (
    <span style={{
      display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
      width: size + 6, height: size + 6, borderRadius: '50%', boxSizing: 'border-box',
      border: ring ? `2px solid ${color}` : '2px solid transparent',
      background: ring ? `${color}26` : faded ? 'rgba(255,255,255,0.65)' : 'transparent',
      filter: faded ? 'grayscale(1)' : undefined,
      opacity: faded ? 0.55 : 1,
    }}>
      <span style={{ fontSize: size, lineHeight: 1, display: 'inline-block', transform: 'scaleX(-1)' }}>
        🏃
      </span>
    </span>
  )
}

export default function PromotionPage() {
  const [managers, setManagers] = useState<ManagerRow[]>([])
  const [settings, setSettings] = useState<PromoSettings>(defaultSettings)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [view, setView] = useState<'track' | 'rank'>('track')
  const [topTab, setTopTab] = useState<'apply' | 'confirmed'>('apply')
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const cheer = useCheer(
    (settings.cheer_messages && settings.cheer_messages.length > 0) ? settings.cheer_messages : CHEER_MESSAGES
  )

  useEffect(() => { load() }, [])

  async function load() {
    const { data: s } = await supabase.from('promotion_settings').select('*').eq('id', 1).maybeSingle()
    if (s) {
      setSettings({
        ...defaultSettings,
        ...s,
        title: s.title || defaultSettings.title,
        target1: toNum(s.target1, defaultSettings.target1),
        target2: toNum(s.target2, defaultSettings.target2),
        target3: toNum(s.target3, defaultSettings.target3),
        progress1: toNum(s.progress1),
        progress2: toNum(s.progress2),
        progress3: toNum(s.progress3),
        current_day: toNum(s.current_day, defaultSettings.current_day),
        total_day: toNum(s.total_day, defaultSettings.total_day),
      })
    }
    const { data: rows } = await supabase.from('promotion_managers').select('*').order('performance', { ascending: false })
    if (rows) {
      setManagers(rows.map((r: any) => ({
        ...r,
        performance: toNum(r.performance),
        progress: toNum(r.progress),
      })))
    }
    setLoaded(true)
  }

  const trackMax = useMemo(() => {
    const maxPerf = managers.reduce((m, r) => Math.max(m, r.performance), 0)
    return Math.max(settings.target3, maxPerf, 1) * 1.08
  }, [managers, settings.target3])

  // 순위는 신청 순
  const ranked: RankedManager[] = useMemo(() => {
    return [...managers]
      .sort((a, b) => b.performance - a.performance)
      .map((m, i) => ({ ...m, rank: i + 1, ...getTierInfo(m, settings) }))
  }, [managers, settings])

  const branches = useMemo(() => Array.from(new Set(managers.map(m => m.branch).filter(Boolean))), [managers])

  const byBranch = useMemo(() => (
    selectedBranch ? ranked.filter(m => m.branch === selectedBranch) : ranked
  ), [ranked, selectedBranch])

  const teamsInBranch = useMemo(() => {
    if (!selectedBranch) return []
    const teams = Array.from(new Set(byBranch.map(m => normalizeTeam(m.team)).filter(Boolean)))
    return teams.sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] || '999', 10)
      const nb = parseInt(b.match(/\d+/)?.[0] || '999', 10)
      if (na !== nb) return na - nb
      return a.localeCompare(b)
    })
  }, [byBranch, selectedBranch])

  const filtered = useMemo(() => (
    selectedTeam ? byBranch.filter(m => normalizeTeam(m.team) === selectedTeam) : byBranch
  ), [byBranch, selectedTeam])

  // 구간 카드: 확정 기준
  const card1Count = ranked.filter(m => m.confirmedTier === 1).length
  const card2Count = ranked.filter(m => m.confirmedTier === 2).length
  const card3Count = ranked.filter(m => m.confirmedTier === 3).length
  const confirmedCount = card1Count + card2Count + card3Count
  const confirmedPct = ranked.length ? Math.round((confirmedCount / ranked.length) * 100) : 0

  // TOP 5: 신청 순 / 확정 순 (확정 구간 → 신청 → 진행)
  const top5Apply = ranked.slice(0, 5)
  const top5Confirmed = useMemo(() => (
    ranked
      .filter(m => m.confirmedTier > 0)
      .sort((a, b) => b.confirmedTier - a.confirmedTier || b.performance - a.performance || b.progress - a.progress)
      .slice(0, 5)
  ), [ranked])
  const top5 = topTab === 'apply' ? top5Apply : top5Confirmed

  const searchedManager = useMemo(() => {
    if (!search.trim()) return null
    return ranked.find(m => m.manager_name.includes(search.trim())) || null
  }, [search, ranked])

  useEffect(() => {
    if (searchedManager) {
      setHighlightId(searchedManager.id)
      if (view === 'rank') {
        const el = rowRefs.current[searchedManager.id]
        el?.scrollIntoView({ behavior: 'smooth', block: 'center' })
      }
      const t = setTimeout(() => setHighlightId(null), 2600)
      return () => clearTimeout(t)
    }
  }, [searchedManager, view])

  const dayProgress = Math.min(100, Math.round((settings.current_day / Math.max(settings.total_day, 1)) * 100))

  function selectBranch(b: string | null) {
    setSelectedBranch(b)
    setSelectedTeam(null)
  }

  if (!loaded) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: PAGE_BG, fontFamily: FONT, color: T.textSecondary }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: PAGE_BG, fontFamily: FONT, paddingBottom: 60 }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Jua&display=swap');
        @keyframes bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 0 0 rgba(27,141,181,0.3) } 50% { box-shadow: 0 0 0 8px rgba(27,141,181,0) } }
        .runner { animation: bob 1.1s ease-in-out infinite; display: inline-block; cursor: default; }
        .highlight-row { animation: glow 1s ease-in-out 2; }
        .dot-runner { position: relative; }
        .dot-runner .tip {
          visibility: hidden; opacity: 0; position: absolute; bottom: 130%; left: 50%; transform: translateX(-50%);
          background: #fff; color: ${T.textPrimary}; font-size: 11px; font-weight: 600; padding: 5px 10px; border-radius: 8px;
          border: 1px solid ${T.border}; box-shadow: ${T.shadow};
          white-space: nowrap; transition: opacity .15s; pointer-events: none; z-index: 20;
        }
        .dot-runner:hover .tip { visibility: visible; opacity: 1; }
        .promo-title { font-family: 'Jua', ${FONT}; }
        @media (max-width: 480px) {
          .promo-title { font-size: 32px !important; }
          .promo-stat-num { font-size: 24px !important; }
          .promo-section-pad { padding-left: 12px !important; padding-right: 12px !important; }
          .promo-seg-label { font-size: 10px !important; }
          .promo-seg-cond { font-size: 9px !important; }
          .promo-seg-grid { gap: 6px !important; }
          .promo-seg-body { padding: 10px 10px 12px !important; }
        }
      `}</style>

      {/* 상단 헤더 */}
      <div className="promo-section-pad" style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 10px' }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 16, flexWrap: 'wrap', marginBottom: 22 }}>
          <div style={{ minWidth: 0 }}>
            <div className="promo-title" style={{ fontSize: 48, fontWeight: 400, color: T.titleInk, letterSpacing: '-0.02em', lineHeight: 1.1, wordBreak: 'keep-all' }}>{settings.title}</div>
            <div style={{ height: 6, width: 72, background: T.sea, borderRadius: 3, margin: '12px 0 10px' }} />
            <div style={{ fontSize: 15, color: T.accentDark, fontWeight: 600 }}>
              {selectedBranch ? `${selectedBranch}${selectedTeam ? ' · ' + selectedTeam : ''} 매니저님들, 이렇게 뛰고 있어요` : cheer}
            </div>
          </div>

          {/* 진행 일차 (글래스) */}
          <div style={{ ...GLASS, borderRadius: T.radius, padding: '14px 18px', minWidth: 200, flex: '0 1 260px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: T.textPrimary }}>{settings.current_day}일차 <span style={{ color: T.textMuted, fontWeight: 600 }}>/ {settings.total_day}영업일</span></span>
              <span style={{ fontSize: 12, color: T.accentDark, fontWeight: 700 }}>{Math.max(settings.total_day - settings.current_day, 0)}일 남음</span>
            </div>
            <div style={{ height: 8, background: 'rgba(255,255,255,0.7)', borderRadius: 6, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${dayProgress}%`, background: T.accent, borderRadius: 6, transition: 'width .6s' }} />
            </div>
          </div>
        </div>

        {/* 구간 달성 현황 (확정 기준) */}
        <div className="promo-seg-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {tierList(settings).map((t, i) => {
            const count = [card1Count, card2Count, card3Count][i]
            const color = [T.tier1, T.tier2, T.tier3][i]
            return (
              <div key={i} className="promo-seg-card" style={{ ...GLASS, borderRadius: T.radius, padding: 0, overflow: 'hidden', textAlign: 'left' }}>
                {/* 비치타월 줄무늬 */}
                <div style={{ height: 10, background: `repeating-linear-gradient(90deg, ${color} 0 14px, rgba(255,255,255,0.9) 14px 28px)` }} />
                <div className="promo-seg-body" style={{ padding: '14px 16px 16px' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: color, flexShrink: 0 }} />
                    <span className="promo-seg-label" style={{ fontSize: 13, color: T.textPrimary, fontWeight: 700, whiteSpace: 'nowrap' }}>{i + 1}구간</span>
                  </div>
                  <div className="promo-stat-num" style={{ fontSize: 36, fontWeight: 800, color: T.titleInk, letterSpacing: '-0.03em', lineHeight: 1.15, marginTop: 6 }}>
                    {count}<span style={{ fontSize: 13, color: T.textMuted, fontWeight: 600, marginLeft: 2 }}>명</span>
                  </div>
                  <div style={{ fontSize: 12, color, fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.reward}</div>
                  <div className="promo-seg-cond" style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, marginTop: 2, lineHeight: 1.4 }}>{conditionText(t.a, t.p)}</div>
                </div>
              </div>
            )
          })}
        </div>

        {/* TOP 5 (신청 / 확정 탭) */}
        <div style={{ ...GLASS, borderRadius: T.radius, padding: '22px 28px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ display: 'flex', gap: 6 }}>
              {[
                { key: 'apply', label: '신청 TOP 5' },
                { key: 'confirmed', label: '확정 TOP 5' },
              ].map(t => (
                <button key={t.key} onClick={() => setTopTab(t.key as 'apply' | 'confirmed')} style={topTabStyle(topTab === t.key)}>
                  {t.label}
                </button>
              ))}
            </div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.accentDark, background: T.accentSoft, padding: '4px 12px', borderRadius: 20 }}>
              확정 {confirmedPct}% ({confirmedCount}/{ranked.length}명)
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
            {top5.length === 0 ? (
              <div style={{ width: '100%', textAlign: 'center', padding: '18px 0', fontSize: 13, color: T.textMuted }}>
                아직 확정자가 없어요. 신청과 진행을 모두 채우면 여기에 올라와요
              </div>
            ) : top5.map((m, i) => (
              <div key={m.id} style={{
                flex: '0 0 auto', minWidth: 92, textAlign: 'center', padding: '14px 10px', borderRadius: T.radiusSm,
                background: i === 0 ? T.accentSoft : 'rgba(255,255,255,0.7)',
                border: i === 0 ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
              }}>
                <div style={{ fontSize: 16 }}>{i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, marginTop: 4, whiteSpace: 'nowrap' }}>{m.manager_name}</div>
                <div style={{ fontSize: 12, color: T.accentDark, fontWeight: 700 }}>신청 {m.performance}</div>
                <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600 }}>진행 {m.progress}</div>
                {m.confirmedTier > 0 && (
                  <div style={{ display: 'inline-block', marginTop: 6, fontSize: 10, fontWeight: 700, color: '#fff', background: tierColor(m.confirmedTier), borderRadius: 8, padding: '1px 7px', whiteSpace: 'nowrap' }}>
                    {m.confirmedTier}구간 확정
                  </div>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* 검색 */}
        <div style={{ marginBottom: 16 }}>
          <input
            value={search}
            onChange={e => setSearch(e.target.value)}
            placeholder="매니저명 검색해보세요"
            style={{
              width: '100%', padding: '14px 18px', fontSize: 14, borderRadius: T.radiusSm,
              border: `1px solid ${T.border}`, outline: 'none', boxSizing: 'border-box',
              background: T.card, boxShadow: T.shadow, fontFamily: FONT, color: T.textPrimary,
            }}
          />
          {search.trim() && !searchedManager && (
            <div style={{ textAlign: 'center', fontSize: 12, color: '#DC2626', marginTop: 6 }}>일치하는 매니저를 찾을 수 없어요</div>
          )}
        </div>

        {/* 검색된 매니저 확대 카드 */}
        {searchedManager && (
          <div style={{
            background: T.card, borderRadius: T.radius, padding: '28px 32px',
            marginBottom: 20, boxShadow: T.shadow, border: `1px solid ${T.accent}`,
            textAlign: 'center',
          }}>
            <div style={{ display: 'flex', justifyContent: 'center' }}>
              <RunnerIcon confirmedTier={searchedManager.confirmedTier} faded={searchedManager.pending} size={36} />
            </div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary, marginTop: 6, letterSpacing: '-0.02em' }}>
              {searchedManager.manager_name}
              {isTeamLead(searchedManager.team) && <span style={{ fontSize: 11, color: '#fff', background: T.tier2, borderRadius: 6, padding: '2px 7px', marginLeft: 6, verticalAlign: 2 }}>팀장</span>}
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 12 }}>{searchedManager.branch} · {normalizeTeam(searchedManager.team)}</div>
            <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'baseline', gap: 18 }}>
              <div>
                <span style={{ fontSize: 32, fontWeight: 700, color: T.accent, letterSpacing: '-0.02em' }}>{searchedManager.performance}</span>
                <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, marginLeft: 4 }}>신청</span>
              </div>
              <div>
                <span style={{ fontSize: 32, fontWeight: 700, color: T.accentDark, letterSpacing: '-0.02em' }}>{searchedManager.progress}</span>
                <span style={{ fontSize: 12, color: T.textMuted, fontWeight: 600, marginLeft: 4 }}>진행</span>
              </div>
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 14 }}>
              신청 기준 전체 {searchedManager.rank}위 ·{' '}
              <span style={{ fontWeight: 700, color: searchedManager.confirmedTier > 0 ? tierColor(searchedManager.confirmedTier) : T.textSecondary }}>
                {statusText(searchedManager)}
              </span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.accentDark }}>
              {nextStepMessage(searchedManager, settings)}
            </div>
          </div>
        )}

        {/* 지사 필터 */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <button onClick={() => selectBranch(null)} style={branchBtnStyle(!selectedBranch)}>전체 지사</button>
          {branches.map(b => (
            <button key={b} onClick={() => selectBranch(b)} style={branchBtnStyle(selectedBranch === b)}>{b}</button>
          ))}
        </div>

        {/* 팀 필터 */}
        {selectedBranch && teamsInBranch.length > 0 && (
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 16 }}>
            <button onClick={() => setSelectedTeam(null)} style={teamBtnStyle(!selectedTeam)}>전체 팀</button>
            {teamsInBranch.map(t => (
              <button key={t} onClick={() => setSelectedTeam(t)} style={teamBtnStyle(selectedTeam === t)}>{t}</button>
            ))}
          </div>
        )}

        {/* 뷰 전환 탭 */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16, marginTop: selectedBranch ? 0 : 8 }}>
          {[
            { key: 'track', label: '전체보기' },
            { key: 'rank', label: '순위보기' },
          ].map(t => (
            <button
              key={t.key}
              onClick={() => setView(t.key as 'track' | 'rank')}
              style={{
                flex: 1, padding: '13px 0', borderRadius: T.radiusSm, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: FONT,
                border: view === t.key ? `1.5px solid ${T.accent}` : `1px solid ${T.border}`,
                background: view === t.key ? T.accentSoft : T.card,
                color: view === t.key ? T.accentDark : T.textSecondary,
              }}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* 컨텐츠 영역 */}
      <div className="promo-section-pad" style={{ maxWidth: 960, margin: '0 auto', padding: '0 24px' }}>
        {view === 'track' ? (
          <TrackView managers={filtered} settings={settings} trackMax={trackMax} highlightId={highlightId} />
        ) : (
          <RankView managers={filtered} settings={settings} trackMax={trackMax} highlightId={highlightId} rowRefs={rowRefs} />
        )}
      </div>
    </div>
  )
}

function branchBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '9px 16px', borderRadius: 20, fontSize: 12, fontWeight: 600, cursor: 'pointer',
    fontFamily: FONT,
    border: active ? `1.5px solid ${T.accent}` : `1px solid ${T.border}`,
    background: active ? T.accent : T.card,
    color: active ? '#fff' : T.textSecondary,
  }
}
function teamBtnStyle(active: boolean): React.CSSProperties {
  return {
    padding: '7px 14px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer',
    fontFamily: FONT,
    border: active ? `1.5px solid ${T.accentDark}` : `1px solid ${T.border}`,
    background: active ? T.accentDark : T.card,
    color: active ? '#fff' : T.textSecondary,
  }
}
function topTabStyle(active: boolean): React.CSSProperties {
  return {
    padding: '6px 14px', borderRadius: 20, fontSize: 13, fontWeight: 700, cursor: 'pointer',
    fontFamily: FONT,
    border: active ? `1.5px solid ${T.accent}` : `1px solid ${T.border}`,
    background: active ? T.accentSoft : T.card,
    color: active ? T.accentDark : T.textMuted,
  }
}

// ============================================================
// 전체보기 (마라톤 출발선)
// - 위치 = 신청, 테두리 색 = 확정 구간, 흐림 = 깃발 넘었지만 미확정
// ============================================================
function TrackView({
  managers, settings, trackMax, highlightId,
}: {
  managers: RankedManager[]
  settings: PromoSettings
  trackMax: number
  highlightId: number | null
}) {
  const LANES = 20
  const LANE_HEIGHT = 13
  const trackHeight = LANES * LANE_HEIGHT + 16

  return (
    <div style={{ ...GLASS, borderRadius: T.radius, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 0', fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
        해변을 달리는 중! · {managers.length}명 <span style={{ color: T.textMuted, fontWeight: 500 }}>(러너에 마우스를 올려보세요)</span>
      </div>
      <div style={{ padding: '6px 24px 0', fontSize: 11, color: T.textMuted, fontWeight: 500, display: 'flex', gap: 12, flexWrap: 'wrap' }}>
        <span>위치 = 신청</span>
        <span>동그라미 색 = 확정 구간</span>
        <span>흐린 러너 = 진행 부족으로 미확정</span>
      </div>

      {/* 바다 + 파도 장식 */}
      <div style={{ position: 'relative', margin: '14px 20px 0', height: 34, borderRadius: `${T.radiusSm}px ${T.radiusSm}px 0 0`, background: T.sea, overflow: 'hidden' }}>
        <div style={{ position: 'absolute', top: 5, left: '3%', fontSize: 16, lineHeight: 1 }}>☀️</div>
        <div style={{ position: 'absolute', top: 9, left: '13%', fontSize: 12, lineHeight: 1, opacity: 0.9 }}>⛵</div>
        <svg viewBox="0 0 400 12" preserveAspectRatio="none" style={{ position: 'absolute', left: 0, bottom: 0, width: '100%', height: 12 }}>
          <path d="M0 6 Q 10 0 20 6 T 40 6 T 60 6 T 80 6 T 100 6 T 120 6 T 140 6 T 160 6 T 180 6 T 200 6 T 220 6 T 240 6 T 260 6 T 280 6 T 300 6 T 320 6 T 340 6 T 360 6 T 380 6 T 400 6 V 12 H 0 Z" fill={T.foam} />
        </svg>
      </div>

      <div style={{
        position: 'relative', height: trackHeight, margin: '0 20px 24px',
        borderRadius: `0 0 ${T.radiusSm}px ${T.radiusSm}px`, overflow: 'visible',
        background: T.sand,
        backgroundImage: `repeating-linear-gradient(180deg, transparent 0 25px, ${T.sandLine} 25px 26px)`,
        border: `1px solid #E2C88E`, borderTop: 'none',
      }}>

        <div style={{ position: 'absolute', right: -6, bottom: -10, fontSize: 26, lineHeight: 1, pointerEvents: 'none' }}>🌴</div>

        <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 0, borderLeft: `2px dashed ${T.sandDark}` }} />
        <div style={{ position: 'absolute', left: 6, top: -1, fontSize: 10, fontWeight: 700, color: '#fff', background: T.sandDark, padding: '0 4px', borderRadius: 3, zIndex: 4 }}>출발</div>

        {[
          { t: settings.target1, label: '1구간', color: T.tier1 },
          { t: settings.target2, label: '2구간', color: T.tier2 },
          { t: settings.target3, label: '3구간', color: T.tier3 },
        ].map((booth, i) => {
          const leftPct = 6 + (booth.t / trackMax) * 90
          return (
            <div key={i} style={{ position: 'absolute', left: `${leftPct}%`, top: 0, bottom: 0, width: 0, borderLeft: `1.5px dashed ${booth.color}99`, zIndex: 3 }}>
              <div style={{ position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)', fontSize: 15, lineHeight: 1 }}>🚩</div>
              <div style={{
                position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap',
                background: booth.color, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
              }}>
                {booth.label}
              </div>
            </div>
          )
        })}

        <div style={{ position: 'absolute', left: '96%', top: 0, bottom: 0, width: 0, borderLeft: `2px dashed ${T.textPrimary}55`, zIndex: 3 }}>
          <div style={{ position: 'absolute', top: -32, left: '50%', transform: 'translateX(-50%)', fontSize: 16, lineHeight: 1 }}>🏁</div>
          <div style={{
            position: 'absolute', top: -14, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap',
            background: T.textPrimary, color: '#fff', fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
          }}>
            도착
          </div>
        </div>

        {managers.map(m => {
          const leftPct = 6 + (m.performance / trackMax) * 90
          const lane = m.id % LANES
          const jitter = (seededRandom(m.id) - 0.5) * 1.5
          const topPx = 10 + lane * LANE_HEIGHT + jitter
          const tipBelow = lane < LANES / 3
          const isHighlighted = highlightId === m.id
          return (
            <div
              key={m.id}
              className="dot-runner"
              style={{
                position: 'absolute', left: `${leftPct}%`, top: topPx, transform: 'translate(-50%, -50%)',
                zIndex: isHighlighted ? 10 : m.rank <= 3 ? 5 : 2,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {m.rank === 1 && <div style={{ fontSize: 11, lineHeight: 1, marginBottom: 1 }}>👑</div>}
                {(m.rank === 2 || m.rank === 3) && <div style={{ fontSize: 10, lineHeight: 1, marginBottom: 1 }}>🔥</div>}
                <div
                  className="runner"
                  style={{
                    filter: isHighlighted ? `drop-shadow(0 0 4px ${T.accent})` : m.rank === 1 ? 'drop-shadow(0 0 3px #F59E0B)' : 'none',
                    animationDelay: `${(m.id % 10) * 0.12}s`,
                  }}
                >
                  <RunnerIcon confirmedTier={m.confirmedTier} faded={m.pending} size={m.rank <= 3 ? 18 : 14} />
                </div>
              </div>
              <div className="tip" style={tipBelow ? { bottom: 'auto', top: '130%' } : undefined}>
                {m.manager_name}{isTeamLead(m.team) ? ' (팀장)' : ''} · 신청 {m.performance} / 진행 {m.progress} · {statusText(m)}
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// 순위보기 (막대바 리스트)
// - 막대 길이 = 신청, 막대 색 = 확정 구간
// ============================================================
function RankView({
  managers, settings, trackMax, highlightId, rowRefs,
}: {
  managers: RankedManager[]
  settings: PromoSettings
  trackMax: number
  highlightId: number | null
  rowRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>
}) {
  return (
    <div style={{ ...GLASS, borderRadius: T.radius, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 0', fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
        매니저 목록 ({managers.length}명) <span style={{ color: T.textMuted, fontWeight: 500, fontSize: 11 }}>막대 = 신청 · 색 = 확정 구간</span>
      </div>

      <div style={{ position: 'relative', margin: '14px 24px 0', height: 18, fontSize: 10, color: T.textMuted, fontWeight: 600 }}>
        <span style={{ position: 'absolute', left: `${(settings.target1 / trackMax) * 100}%`, transform: 'translateX(-50%)', color: T.tier1 }}>{settings.target1}</span>
        <span style={{ position: 'absolute', left: `${(settings.target2 / trackMax) * 100}%`, transform: 'translateX(-50%)', color: T.tier2 }}>{settings.target2}</span>
        <span style={{ position: 'absolute', left: `${(settings.target3 / trackMax) * 100}%`, transform: 'translateX(-50%)', color: T.tier3 }}>{settings.target3}</span>
      </div>

      <div style={{ maxHeight: 560, overflowY: 'auto', padding: '6px 24px 24px' }}>
        {managers.map(m => {
          const pct = Math.min(100, (m.performance / trackMax) * 100)
          const tierColorValue = tierColor(m.confirmedTier)
          const isHighlighted = highlightId === m.id
          return (
            <div
              key={m.id}
              ref={el => { rowRefs.current[m.id] = el }}
              className={isHighlighted ? 'highlight-row' : ''}
              style={{
                display: 'flex', alignItems: 'center', gap: 10, padding: '8px 4px',
                borderRadius: 8,
                background: isHighlighted ? T.accentSoft : 'transparent',
                transition: 'background .3s',
              }}
            >
              <div style={{ width: 28, fontSize: 11, fontWeight: 600, color: T.textMuted, textAlign: 'right', flexShrink: 0 }}>{m.rank}</div>
              <div style={{ width: 78, fontSize: 12, fontWeight: 600, color: T.textPrimary, flexShrink: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                {m.manager_name}{isTeamLead(m.team) && <span style={{ fontSize: 9, color: '#fff', background: T.tier2, borderRadius: 4, padding: '0 4px', marginLeft: 3 }}>팀장</span>}
              </div>
              <div style={{
                flex: 1, position: 'relative', height: 18,
                background: T.bg, border: `1px solid ${T.border}`,
                borderRadius: 6, overflow: 'visible',
              }}>
                <div style={{ position: 'absolute', left: `${(settings.target1 / trackMax) * 100}%`, top: 0, bottom: 0, width: 0, borderLeft: `1px dashed ${T.tier1}66` }} />
                <div style={{ position: 'absolute', left: `${(settings.target2 / trackMax) * 100}%`, top: 0, bottom: 0, width: 0, borderLeft: `1px dashed ${T.tier2}66` }} />
                <div style={{ position: 'absolute', left: `${(settings.target3 / trackMax) * 100}%`, top: 0, bottom: 0, width: 0, borderLeft: `1px dashed ${T.tier3}66` }} />
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: tierColorValue, opacity: m.pending ? 0.5 : 1, borderRadius: 6, transition: 'width .5s' }} />
                <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%)' }}>
                  <div className="runner"><RunnerIcon confirmedTier={m.confirmedTier} faded={m.pending} size={14} /></div>
                </div>
              </div>
              <div style={{ width: 48, textAlign: 'right', flexShrink: 0, lineHeight: 1.25 }}>
                <div style={{ fontSize: 12, fontWeight: 700, color: m.confirmedTier > 0 ? tierColorValue : T.textSecondary }}>{m.performance}</div>
                <div style={{ fontSize: 10, fontWeight: 600, color: T.textMuted }}>진행 {m.progress}</div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}