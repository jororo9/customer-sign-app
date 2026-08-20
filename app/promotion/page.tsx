'use client'

import { useEffect, useMemo, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

type ManagerRow = {
  id: number
  branch: string
  team: string
  manager_name: string
  performance: number
}

type PromoSettings = {
  title: string
  target1: number; target2: number; target3: number
  reward1_text: string; reward2_text: string; reward3_text: string
  current_day: number; total_day: number
  cheer_messages?: string[]
}

const defaultSettings: PromoSettings = {
  title: '상담매니저 초중 이벤트',
  target1: 5, target2: 10, target3: 15,
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

// ---- 디자인 토큰 (모던 SaaS 대시보드) ----
const T = {
  bg: '#F1F5F9',
  card: '#FFFFFF',
  border: '#E2E8F0',
  shadow: '0 4px 6px -1px rgba(0,0,0,0.05)',
  radius: 16,
  radiusSm: 10,
  accent: '#0D9488',
  accentDark: '#0F766E',
  accentSoft: '#F0FDFA',
  textPrimary: '#0F172A',
  textSecondary: '#64748B',
  textMuted: '#94A3B8',
  tier1: '#D97706',
  tier2: '#EA580C',
  tier3: '#DB2777',
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

const RUNNER_EMOJIS = ['🐣', '🐰', '🐱', '🐶', '🐻', '🦊', '🏃💨']
function pickRunnerEmoji(id: number) {
  const idx = Math.floor(seededRandom(id * 7 + 3) * RUNNER_EMOJIS.length)
  return RUNNER_EMOJIS[Math.min(idx, RUNNER_EMOJIS.length - 1)]
}

export default function PromotionPage() {
  const [managers, setManagers] = useState<ManagerRow[]>([])
  const [settings, setSettings] = useState<PromoSettings>(defaultSettings)
  const [loaded, setLoaded] = useState(false)
  const [search, setSearch] = useState('')
  const [highlightId, setHighlightId] = useState<number | null>(null)
  const [view, setView] = useState<'track' | 'rank'>('track')
  const [selectedBranch, setSelectedBranch] = useState<string | null>(null)
  const [selectedTeam, setSelectedTeam] = useState<string | null>(null)
  const rowRefs = useRef<Record<number, HTMLDivElement | null>>({})
  const cheer = useCheer(
    (settings.cheer_messages && settings.cheer_messages.length > 0) ? settings.cheer_messages : CHEER_MESSAGES
  )

  useEffect(() => { load() }, [])

  async function load() {
    const { data: s } = await supabase.from('promotion_settings').select('*').eq('id', 1).maybeSingle()
    if (s) setSettings(s as PromoSettings)
    const { data: rows } = await supabase.from('promotion_managers').select('*').order('performance', { ascending: false })
    if (rows) setManagers(rows as ManagerRow[])
    setLoaded(true)
  }

  const trackMax = useMemo(() => {
    const maxPerf = managers.reduce((m, r) => Math.max(m, r.performance), 0)
    return Math.max(settings.target3, maxPerf, 1) * 1.08
  }, [managers, settings.target3])

  const ranked = useMemo(() => {
    return [...managers]
      .sort((a, b) => b.performance - a.performance)
      .map((m, i) => ({ ...m, rank: i + 1 }))
  }, [managers])

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

  const top5 = ranked.slice(0, 5)

  const seg1Count = managers.filter(m => m.performance >= settings.target1).length
  const card1Count = managers.filter(m => m.performance >= settings.target1 && m.performance < settings.target2).length
  const card2Count = managers.filter(m => m.performance >= settings.target2 && m.performance < settings.target3).length
  const card3Count = managers.filter(m => m.performance >= settings.target3).length

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
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: T.bg, fontFamily: FONT, color: T.textSecondary }}>
        불러오는 중...
      </div>
    )
  }

  return (
    <div style={{ minHeight: '100vh', background: T.bg, fontFamily: FONT, paddingBottom: 60 }}>
      <style>{`
        @keyframes bob { 0%,100% { transform: translateY(0) } 50% { transform: translateY(-4px) } }
        @keyframes glow { 0%,100% { box-shadow: 0 0 0 0 rgba(13,148,136,0.25) } 50% { box-shadow: 0 0 0 8px rgba(13,148,136,0) } }
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
        @media (max-width: 480px) {
          .promo-title { font-size: 20px !important; }
          .promo-stat-num { font-size: 18px !important; }
          .promo-section-pad { padding-left: 12px !important; padding-right: 12px !important; }
        }
      `}</style>

      {/* 상단 헤더 */}
      <div className="promo-section-pad" style={{ maxWidth: 960, margin: '0 auto', padding: '32px 24px 10px' }}>
        <div style={{ textAlign: 'center', marginBottom: 22 }}>
          <div className="promo-title" style={{ fontSize: 26, fontWeight: 700, color: T.textPrimary, letterSpacing: '-0.02em' }}>{settings.title}</div>
          <div style={{ fontSize: 14, color: T.accentDark, marginTop: 6, fontWeight: 600 }}>
            {selectedBranch ? `${selectedBranch}${selectedTeam ? ' · ' + selectedTeam : ''} 매니저님들, 이렇게 뛰고 있어요` : cheer}
          </div>
        </div>

        {/* 진행률 바 */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: T.radius, padding: '22px 28px', marginBottom: 16 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13, fontWeight: 600, color: T.textPrimary, marginBottom: 10 }}>
            <span>{settings.current_day}일차 / 총 {settings.total_day}영업일</span>
            <span style={{ color: T.textMuted }}>{Math.max(settings.total_day - settings.current_day, 0)}일 남음</span>
          </div>
          <div style={{ height: 8, background: T.bg, borderRadius: 6, overflow: 'hidden' }}>
            <div style={{ height: '100%', width: `${dayProgress}%`, background: T.accent, borderRadius: 6, transition: 'width .6s' }} />
          </div>
        </div>

        {/* 구간 달성 현황 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12, marginBottom: 16 }}>
          {[
            { label: `1구간 (${settings.target1}↑)`, reward: settings.reward1_text, count: card1Count, color: T.tier1 },
            { label: `2구간 (${settings.target2}↑)`, reward: settings.reward2_text, count: card2Count, color: T.tier2 },
            { label: `3구간 (${settings.target3}↑)`, reward: settings.reward3_text, count: card3Count, color: T.tier3 },
          ].map((s, i) => (
            <div key={i} style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: T.radius, padding: '20px 14px', textAlign: 'center' }}>
              <div style={{ fontSize: 11, color: T.textMuted, fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.03em' }}>{s.label}</div>
              <div style={{ fontSize: 12, color: s.color, fontWeight: 700, marginBottom: 6 }}>{s.reward}</div>
              <div className="promo-stat-num" style={{ fontSize: 24, fontWeight: 700, color: T.textPrimary, letterSpacing: '-0.02em' }}>{s.count}<span style={{ fontSize: 12, color: T.textMuted, fontWeight: 500 }}> 명</span></div>
            </div>
          ))}
        </div>

        {/* TOP 랭킹 */}
        <div style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: T.radius, padding: '22px 28px', marginBottom: 16 }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 8 }}>
            <div style={{ fontSize: 14, fontWeight: 700, color: T.textPrimary }}>TOP 5</div>
            <div style={{ fontSize: 11, fontWeight: 600, color: T.accentDark, background: T.accentSoft, padding: '4px 12px', borderRadius: 20 }}>
              1구간 이상 달성 {managers.length ? Math.round((seg1Count / managers.length) * 100) : 0}% ({seg1Count}/{managers.length}명)
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, overflowX: 'auto' }}>
            {top5.map((m, i) => (
              <div key={m.id} style={{
                flex: '0 0 auto', minWidth: 92, textAlign: 'center', padding: '14px 10px', borderRadius: T.radiusSm,
                background: i === 0 ? T.accentSoft : T.bg,
                border: i === 0 ? `1px solid ${T.accent}` : `1px solid ${T.border}`,
              }}>
                <div style={{ fontSize: 16 }}>{i === 0 ? '👑' : i === 1 ? '🥈' : i === 2 ? '🥉' : `#${i + 1}`}</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: T.textPrimary, marginTop: 4, whiteSpace: 'nowrap' }}>{m.manager_name}</div>
                <div style={{ fontSize: 12, color: T.accentDark, fontWeight: 700 }}>{m.performance}</div>
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
            <div style={{ fontSize: 34 }}>🏃</div>
            <div style={{ fontSize: 22, fontWeight: 700, color: T.textPrimary, marginTop: 6, letterSpacing: '-0.02em' }}>
              {searchedManager.manager_name}
              {isTeamLead(searchedManager.team) && <span style={{ fontSize: 11, color: '#fff', background: T.tier2, borderRadius: 6, padding: '2px 7px', marginLeft: 6, verticalAlign: 2 }}>팀장</span>}
            </div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 12 }}>{searchedManager.branch} · {normalizeTeam(searchedManager.team)}</div>
            <div style={{ fontSize: 32, fontWeight: 700, color: T.accent, letterSpacing: '-0.02em' }}>{searchedManager.performance}</div>
            <div style={{ fontSize: 13, color: T.textMuted, marginBottom: 14 }}>현재 실적 · 전체 {searchedManager.rank}위</div>
            <div style={{ fontSize: 13, fontWeight: 600, color: T.accentDark }}>
              {searchedManager.performance >= settings.target3
                ? `3구간 달성! ${settings.reward3_text} 획득`
                : searchedManager.performance >= settings.target2
                  ? `3구간까지 ${settings.target3 - searchedManager.performance} 남았어요`
                  : searchedManager.performance >= settings.target1
                    ? `2구간까지 ${settings.target2 - searchedManager.performance} 남았어요`
                    : `1구간까지 ${settings.target1 - searchedManager.performance} 남았어요`}
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

// ============================================================
// 전체보기 (마라톤 출발선)
// ============================================================
function TrackView({
  managers, settings, trackMax, highlightId,
}: {
  managers: (ManagerRow & { rank: number })[]
  settings: PromoSettings
  trackMax: number
  highlightId: number | null
}) {
  const LANES = 20
  const LANE_HEIGHT = 13
  const trackHeight = LANES * LANE_HEIGHT + 16

  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: T.radius, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 0', fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
        다 함께 출발선에서! · {managers.length}명 <span style={{ color: T.textMuted, fontWeight: 500 }}>(이모지에 마우스를 올려보세요)</span>
      </div>

      <div style={{ position: 'relative', height: trackHeight, margin: '30px 20px 24px', borderRadius: T.radiusSm, overflow: 'visible', background: '#E8F5E9', backgroundImage: 'repeating-linear-gradient(90deg, rgba(76,175,80,0.06) 0 2px, transparent 2px 40px)', border: `1px solid ${T.border}` }}>

        <div style={{ position: 'absolute', left: 8, top: 0, bottom: 0, width: 0, borderLeft: `2px dashed ${T.textMuted}` }} />
        <div style={{ position: 'absolute', left: 6, top: -1, fontSize: 10, fontWeight: 700, color: T.textSecondary, background: '#E8F5E9', padding: '0 3px' }}>출발</div>

        {[
          { t: settings.target1, reward: settings.reward1_text, color: T.tier1 },
          { t: settings.target2, reward: settings.reward2_text, color: T.tier2 },
          { t: settings.target3, reward: settings.reward3_text, color: T.tier3 },
        ].map((booth, i) => {
          const leftPct = 6 + (booth.t / trackMax) * 90
          return (
            <div key={i} style={{ position: 'absolute', left: `${leftPct}%`, top: 0, bottom: 0, width: 0, borderLeft: `1px dashed ${booth.color}88`, zIndex: 3 }}>
              <div style={{ position: 'absolute', top: -26, left: '50%', transform: 'translateX(-50%)', fontSize: 20, lineHeight: 1 }}>🎁</div>
              <div style={{
                position: 'absolute', top: -1, left: '50%', transform: 'translateX(-50%)', whiteSpace: 'nowrap',
                background: '#fff', color: booth.color, border: `1px solid ${booth.color}55`, fontSize: 10, fontWeight: 700, padding: '2px 8px', borderRadius: 10,
              }}>
                {booth.reward}
              </div>
            </div>
          )
        })}

        {managers.map(m => {
          const leftPct = 6 + (m.performance / trackMax) * 90
          const lane = m.id % LANES
          const jitter = (seededRandom(m.id) - 0.5) * 1.5
          const topPx = 10 + lane * LANE_HEIGHT + jitter
          const tipBelow = lane < LANES / 3
          const tier = m.performance >= settings.target3 ? 3 : m.performance >= settings.target2 ? 2 : m.performance >= settings.target1 ? 1 : 0
          const isHighlighted = highlightId === m.id
          const emoji = pickRunnerEmoji(m.id)
          return (
            <div
              key={m.id}
              className="dot-runner"
              style={{
                position: 'absolute', left: `${leftPct}%`, top: topPx, transform: 'translate(-50%, -50%)',
                zIndex: isHighlighted ? 10 : m.rank <= 3 ? 5 : 2,
              }}
            >
              <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', transform: 'scaleX(-1)' }}>
                {m.rank === 1 && <div style={{ fontSize: 11, lineHeight: 1, marginBottom: 1 }}>👑</div>}
                {(m.rank === 2 || m.rank === 3) && <div style={{ fontSize: 10, lineHeight: 1, marginBottom: 1 }}>🔥</div>}
                <div
                  className="runner"
                  style={{
                    fontSize: m.rank <= 3 ? 15 : 12,
                    filter: isHighlighted ? `drop-shadow(0 0 4px ${T.accent})` : m.rank === 1 ? 'drop-shadow(0 0 3px #F59E0B)' : 'none',
                    animationDelay: `${(m.id % 10) * 0.12}s`,
                  }}
                >
                  {tier > 0 ? emoji : '🐌'}
                </div>
              </div>
              <div className="tip" style={tipBelow ? { bottom: 'auto', top: '130%' } : undefined}>{m.manager_name}{isTeamLead(m.team) ? ' (팀장)' : ''} · {m.performance}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ============================================================
// 순위보기 (막대바 리스트)
// ============================================================
function RankView({
  managers, settings, trackMax, highlightId, rowRefs,
}: {
  managers: (ManagerRow & { rank: number })[]
  settings: PromoSettings
  trackMax: number
  highlightId: number | null
  rowRefs: React.MutableRefObject<Record<number, HTMLDivElement | null>>
}) {
  return (
    <div style={{ background: T.card, border: `1px solid ${T.border}`, boxShadow: T.shadow, borderRadius: T.radius, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 0', fontSize: 13, fontWeight: 700, color: T.textPrimary }}>
        매니저 목록 ({managers.length}명)
      </div>

      <div style={{ position: 'relative', margin: '14px 24px 0', height: 18, fontSize: 10, color: T.textMuted, fontWeight: 600 }}>
        <span style={{ position: 'absolute', left: `${(settings.target1 / trackMax) * 100}%`, transform: 'translateX(-50%)', color: T.tier1 }}>{settings.target1}</span>
        <span style={{ position: 'absolute', left: `${(settings.target2 / trackMax) * 100}%`, transform: 'translateX(-50%)', color: T.tier2 }}>{settings.target2}</span>
        <span style={{ position: 'absolute', left: `${(settings.target3 / trackMax) * 100}%`, transform: 'translateX(-50%)', color: T.tier3 }}>{settings.target3}</span>
      </div>

      <div style={{ maxHeight: 560, overflowY: 'auto', padding: '6px 24px 24px' }}>
        {managers.map(m => {
          const pct = Math.min(100, (m.performance / trackMax) * 100)
          const tier = m.performance >= settings.target3 ? 3 : m.performance >= settings.target2 ? 2 : m.performance >= settings.target1 ? 1 : 0
          const tierColor = tier === 3 ? T.tier3 : tier === 2 ? T.tier2 : tier === 1 ? T.tier1 : '#CBD5E1'
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
                <div style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, background: tierColor, borderRadius: 6, transition: 'width .5s' }} />
                <div style={{ position: 'absolute', left: `${pct}%`, top: '50%', transform: 'translate(-50%, -50%) scaleX(-1)' }}>
                  <div className="runner" style={{ fontSize: 13 }}>🏃</div>
                </div>
              </div>
              <div style={{ width: 32, fontSize: 12, fontWeight: 700, color: tierColor, textAlign: 'right', flexShrink: 0 }}>{m.performance}</div>
            </div>
          )
        })}
      </div>
    </div>
  )
}