'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import html2canvas from 'html2canvas'

interface NoticeItem { label: string; content: string }
interface PeriodEntry { code: string; period: string }

type GiftSettings = {
  page_title: string
  page_description: string
  banner_text: string
  template_image_url: string
  bottom_image_url: string
  brand_name: string
  product_name: string
  amount_text: string
  period_options: PeriodEntry[]
  usage_method: string
  exchange_place: string
  extra_items: NoticeItem[]
  background_color: string
}

const DEFAULT_TITLE = 'B상품권 기프티콘 이미지 생성'
const DEFAULT_DESCRIPTION = '정보를 입력한 뒤 이미지에 반영하기로 미리보기를 확인하고, 쿠폰 이미지를 저장하세요'

const emptyGift: GiftSettings = {
  page_title: DEFAULT_TITLE,
  page_description: DEFAULT_DESCRIPTION,
  banner_text: '',
  template_image_url: '',
  bottom_image_url: '',
  brand_name: '',
  product_name: '',
  amount_text: '',
  period_options: [],
  usage_method: '',
  exchange_place: '',
  extra_items: [],
  background_color: '#FFF3D6',
}

const MAX_ISSUE_COUNT = 5 // 모바일 기반이라 동시 발행은 최대 5건까지만 허용

// 17자리, 띄어쓰기 없이 영문/숫자만
function sanitizeCouponNumber(raw: string) {
  return raw.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17)
}

// ---- 디자인 토큰 (모노톤 베이스 + 파스텔 포인트 최소 사용) ----
const COLOR = {
  bg: '#F7F7F5',
  surface: '#FFFFFF',
  border: '#E8E8E6',
  borderStrong: '#D8D8D5',
  textPrimary: '#17171A',
  textSecondary: '#6B6B70',
  textMuted: '#A0A0A3',
  mintBg: '#DCEEE4',
  mintText: '#2F7A5C',
  mintBorder: '#B7DDCB',
  peachBg: '#FDE8DC',
  peachText: '#B35C2E',
  peachBorder: '#F6CBAE',
  ink: '#17171A',
  inkHover: '#2B2B2E',
  // 메인 헤더 전용 파스텔 세이지 톤 (배경과 은은하게 구분되는 모노톤 파스텔)
  headerBg: '#EEF3EE',
  headerBorder: '#DCE6DC',
}

export default function GiftGeneratePage() {
  const [gift, setGift] = useState<GiftSettings>({ ...emptyGift })
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // ---- 정보입력 / 미리보기 탭 전환 상태 (화면 크기 관계없이 항상 탭으로 분리) ----
  const [activeTab, setActiveTab] = useState<'form' | 'preview'>('form')

  // ---- 입력값 (임시 상태 / draft) ----
  const [issueCountDraft, setIssueCountDraft] = useState('1')
  const [issueCountApplied, setIssueCountApplied] = useState(true) // 발행 건수가 [확인] 버튼으로 적용되었는지 여부
  const [couponNumbersDraft, setCouponNumbersDraft] = useState<string[]>([''])
  const [selectedPeriodIdxDraft, setSelectedPeriodIdxDraft] = useState('') // 기본값 미선택 — 자동으로 첫 항목이 선택되지 않도록
  const [usageMethodDraft, setUsageMethodDraft] = useState('')
  const [exchangePlaceDraft, setExchangePlaceDraft] = useState('')
  const [extraItemsDraft, setExtraItemsDraft] = useState<NoticeItem[]>([])

  // ---- 미리보기(카드)에 실제로 반영된 값 (쿠폰번호/등록기간 등 "이미지에 반영하기"로 적용되는 값들) ----
  const [couponNumbers, setCouponNumbers] = useState<string[]>([''])
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState('')
  const [usageMethod, setUsageMethod] = useState('')
  const [exchangePlace, setExchangePlace] = useState('')
  const [extraItems, setExtraItems] = useState<NoticeItem[]>([])
  const [previewIndex, setPreviewIndex] = useState(0) // 지금 카드에 보여지는 쿠폰 순번 (자유롭게 이동 가능)
  const [savedFlags, setSavedFlags] = useState<boolean[]>([false])

  // ---- 상단 배너 — 매니저가 화면에서 직접 문구를 자유롭게 작성. 반영 버튼과 무관하게 즉시 미리보기에 반영됨 ----
  const [bannerTextInput, setBannerTextInput] = useState('') // 매니저가 직접 쓰는 배너 문구 (어드민의 banner_text는 초기 기본값으로만 사용)
  const [bannerVisible, setBannerVisible] = useState(true)

  const [reflected, setReflected] = useState(false) // "이미지에 반영하기" 눌렀는지 여부
  const [capturing, setCapturing] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => { handleLoad() }, [])

  async function handleLoad() {
    setLoadError(false)
    const { data: row, error } = await supabase.from('gift_settings').select('*').eq('id', 1).maybeSingle()
    if (error || !row) {
      setLoadError(true)
      return
    }
    const loadedPeriods: PeriodEntry[] = (row.period_options || [])
      .map((p: any) => typeof p === 'string' ? { code: '', period: p } : { code: p.code || '', period: p.period || '' })
      .filter((p: PeriodEntry) => p.code.trim() || p.period.trim())
    const g: GiftSettings = {
      page_title: row.page_title || DEFAULT_TITLE,
      page_description: row.page_description || DEFAULT_DESCRIPTION,
      banner_text: row.banner_text || '',
      template_image_url: row.template_image_url || '',
      bottom_image_url: row.bottom_image_url || '',
      brand_name: row.brand_name || '',
      product_name: row.product_name || '',
      amount_text: row.amount_text || '',
      period_options: loadedPeriods,
      usage_method: row.usage_method || '',
      exchange_place: row.exchange_place || '',
      extra_items: row.extra_items || [],
      background_color: row.background_color || '#FFF3D6',
    }
    setGift(g)

    // 초기값을 입력창(draft)에 세팅
    setUsageMethodDraft(g.usage_method)
    setExchangePlaceDraft(g.exchange_place)
    setExtraItemsDraft(g.extra_items.map((it: NoticeItem) => ({ ...it })))
    setSelectedPeriodIdxDraft('') // 항상 "선택해주세요" 상태로 시작

    // 배너 입력창은 어드민이 등록한 문구를 "초안"으로 미리 채워두되, 매니저가 자유롭게 수정 가능
    setBannerTextInput(g.banner_text)

    setLoaded(true)
  }

  function updateExtraItemDraft(i: number, value: string) {
    setExtraItemsDraft(prev => {
      const next = [...prev]
      next[i] = { ...next[i], content: value }
      return next
    })
    setReflected(false)
  }

  // ---- 쿠폰 발행 건수: 숫자만 입력받고, [확인] 버튼을 눌러야 실제로 쿠폰번호 입력칸 개수에 반영됨 ----
  function onIssueCountChange(v: string) {
    const digitsOnly = v.replace(/[^0-9]/g, '')
    setIssueCountDraft(digitsOnly)
    setIssueCountApplied(false) // 값이 바뀌면 아직 미확인 상태로 표시
    setReflected(false)
  }

  function applyIssueCount() {
    const raw = Number(issueCountDraft)
    const n = Number.isFinite(raw) && raw > 0 ? Math.max(1, Math.min(MAX_ISSUE_COUNT, Math.floor(raw))) : 1
    setIssueCountDraft(String(n))
    setCouponNumbersDraft(prev => {
      const next = [...prev]
      if (n > next.length) {
        while (next.length < n) next.push('')
      } else {
        next.length = n
      }
      return next
    })
    setIssueCountApplied(true)
    setReflected(false)
  }

  function onCouponChange(i: number, v: string) {
    setCouponNumbersDraft(prev => {
      const next = [...prev]
      next[i] = sanitizeCouponNumber(v)
      return next
    })
    setReflected(false)
  }
  function onPeriodChange(v: string) { setSelectedPeriodIdxDraft(v); setReflected(false) }
  function onExchangeChange(v: string) { setExchangePlaceDraft(v); setReflected(false) }
  function onUsageChange(v: string) { setUsageMethodDraft(v); setReflected(false) }

  function reflectToImage() {
    // 발행 건수를 바꿔놓고 아직 [확인]을 누르지 않았다면 먼저 확인부터 요청
    if (!issueCountApplied) {
      alert('쿠폰 발행 건수를 변경하셨습니다. [확인] 버튼을 눌러 쿠폰번호 입력칸을 먼저 적용해주세요.')
      return
    }
    const emptyIdx = couponNumbersDraft.findIndex(cn => !cn.trim())
    if (emptyIdx !== -1) {
      alert(`쿠폰번호 ${emptyIdx + 1}번을 입력해주세요.`)
      return
    }
    const invalidIdx = couponNumbersDraft.findIndex(cn => cn.length !== 17)
    if (invalidIdx !== -1) {
      alert(`쿠폰번호 ${invalidIdx + 1}번이 17자리가 아닙니다. 확인해주세요.`)
      return
    }
    if (!selectedPeriodIdxDraft) {
      alert('등록기간을 선택해주세요.')
      return
    }
    setCouponNumbers([...couponNumbersDraft])
    setSelectedPeriodIdx(selectedPeriodIdxDraft)
    setUsageMethod(usageMethodDraft)
    setExchangePlace(exchangePlaceDraft)
    setExtraItems(extraItemsDraft.map(it => ({ ...it })))
    setPreviewIndex(0)
    setSavedFlags(new Array(couponNumbersDraft.length).fill(false))
    setReflected(true)

    // 반영 즉시 미리보기 탭으로 자동 전환
    setActiveTab('preview')
  }

  const selectedPeriod: PeriodEntry | null =
    selectedPeriodIdx !== '' && gift.period_options[Number(selectedPeriodIdx)]
      ? gift.period_options[Number(selectedPeriodIdx)]
      : null

  async function waitForCardImages() {
    if (!cardRef.current) return
    const imgs = cardRef.current.querySelectorAll('img')
    await Promise.all(Array.from(imgs).map(img => {
      if (img.complete) return Promise.resolve()
      return new Promise(res => { img.onload = res; img.onerror = res })
    }))
  }

  // 지금 미리보기에 떠 있는 쿠폰(previewIndex)을 그 자리에서 저장
  async function saveCurrentImage() {
    if (!reflected || !cardRef.current) return

    setCapturing(true)
    await document.fonts.ready
    await waitForCardImages()
    await new Promise(r => setTimeout(r, 150))

    const canvas = await html2canvas(cardRef.current, {
      scale: 3, backgroundColor: '#ffffff', useCORS: true, logging: false, allowTaint: true,
    })

    const link = document.createElement('a')
    link.download = `기프티콘_${couponNumbers[previewIndex] || Date.now()}.jpg`
    link.href = canvas.toDataURL('image/jpeg', 0.95)
    link.click()

    setCapturing(false)
    setSavedFlags(prev => {
      const next = [...prev]
      next[previewIndex] = true
      return next
    })
  }

  function resetGeneration() {
    setIssueCountDraft('1')
    setIssueCountApplied(true)
    setCouponNumbersDraft([''])
    setSelectedPeriodIdxDraft('')
    setUsageMethodDraft(gift.usage_method)
    setExchangePlaceDraft(gift.exchange_place)
    setExtraItemsDraft(gift.extra_items.map((it: NoticeItem) => ({ ...it })))

    setCouponNumbers([''])
    setSelectedPeriodIdx('')
    setUsageMethod('')
    setExchangePlace('')
    setExtraItems([])
    setPreviewIndex(0)
    setSavedFlags([false])
    setReflected(false)

    // 배너 입력값도 어드민 기본 문구로 초기화
    setBannerTextInput(gift.banner_text)
    setBannerVisible(true)

    // 새로 등록 시작 시 다시 입력 탭으로
    setActiveTab('form')
  }

  const isMulti = couponNumbers.length > 1
  const allSaved = reflected && savedFlags.length > 0 && savedFlags.every(Boolean)
  const savedCount = savedFlags.filter(Boolean).length

  const labelStyle: React.CSSProperties = {
    fontSize: 11, fontWeight: 700, color: COLOR.textMuted, marginBottom: 8, display: 'block',
    textTransform: 'uppercase', letterSpacing: '0.04em',
  }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '11px 14px', fontSize: 14, border: `1.5px solid ${COLOR.border}`, borderRadius: 10,
    outline: 'none', fontFamily: 'var(--font-noto-sans-kr), sans-serif', boxSizing: 'border-box',
    color: COLOR.textPrimary, background: COLOR.surface, transition: 'border-color .15s, box-shadow .15s',
  }
  const fieldBox: React.CSSProperties = { marginBottom: 18 }
  const navBtnStyle: React.CSSProperties = {
    width: 34, height: 34, borderRadius: '50%', border: `1.5px solid ${COLOR.border}`, background: COLOR.surface,
    fontSize: 16, color: COLOR.textSecondary, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '32px 16px 60px', fontFamily: 'var(--font-noto-sans-kr), sans-serif', background: COLOR.bg, minHeight: '100vh', overflowX: 'hidden' }}>

      {/* 포커스 링 / 인풋 상태를 위한 최소한의 scoped 스타일 */}
      <style>{`
        .bp-input:focus { border-color: ${COLOR.mintBorder} !important; box-shadow: 0 0 0 3px ${COLOR.mintBg}; }
        .bp-tabbtn { transition: color .15s, background .15s; }
        .bp-primary-btn { transition: background .15s, transform .05s; }
        .bp-primary-btn:hover { background: ${COLOR.inkHover} !important; }
        .bp-primary-btn:active { transform: scale(0.98); }
        .bp-ghost-btn { transition: border-color .15s, background .15s; }
        .bp-ghost-btn:hover { border-color: ${COLOR.borderStrong} !important; background: #FAFAF9 !important; }
      `}</style>

      {/* 타이틀 - 화면 끝까지 이어지는 직사각형(풀블리드) + 블랙&화이트 */}
      <div style={{
        background: COLOR.ink,
        padding: '22px 16px',
        marginTop: -32,
        marginBottom: 20,
        marginLeft: '50%',
        transform: 'translateX(-50%)',
        width: '100vw',
        boxSizing: 'border-box',
      }}>
        <h1 style={{ fontSize: 22, fontWeight: 700, color: '#FFFFFF', letterSpacing: '-0.01em', textAlign: 'center', margin: 0 }}>
          {gift.page_title || DEFAULT_TITLE}
        </h1>
      </div>

      <p style={{ fontSize: 13, color: COLOR.textSecondary, marginBottom: 28, lineHeight: 1.6, textAlign: 'center', whiteSpace: 'pre-wrap' }}>
        {gift.page_description || DEFAULT_DESCRIPTION}
      </p>

      {/* 정보입력 / 미리보기 탭 — 캡슐형 세그먼트 컨트롤 */}
      <div style={{
        display: 'flex', gap: 4, padding: 4, background: '#EFEFED', borderRadius: 14, marginBottom: 20,
      }}>
        <button
          onClick={() => setActiveTab('form')}
          className="bp-tabbtn"
          style={{
            flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--font-noto-sans-kr), sans-serif', border: 'none',
            background: activeTab === 'form' ? COLOR.surface : 'transparent',
            color: activeTab === 'form' ? COLOR.textPrimary : COLOR.textMuted,
            boxShadow: activeTab === 'form' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          📝 정보 입력
        </button>
        <button
          onClick={() => setActiveTab('preview')}
          className="bp-tabbtn"
          style={{
            flex: 1, padding: '11px 0', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
            fontFamily: 'var(--font-noto-sans-kr), sans-serif', border: 'none',
            background: activeTab === 'preview' ? COLOR.surface : 'transparent',
            color: activeTab === 'preview' ? COLOR.textPrimary : COLOR.textMuted,
            boxShadow: activeTab === 'preview' ? '0 1px 3px rgba(0,0,0,0.08)' : 'none',
          }}
        >
          🎁 미리보기
        </button>
      </div>

      <div>

        {/* 입력 영역 */}
        <div
          className={activeTab === 'form' ? 'block' : 'hidden'}
          style={{ background: COLOR.surface, borderRadius: 20, padding: 28, border: `1px solid ${COLOR.border}`, boxShadow: '0 1px 2px rgba(0,0,0,0.03)' }}
        >

          {!loaded && !loadError && (
            <div style={{ fontSize: 13, color: COLOR.textMuted, padding: '24px 0', textAlign: 'center' }}>불러오는 중...</div>
          )}

          {loadError && (
            <div style={{ fontSize: 13, color: COLOR.peachText, padding: '16px 0', textAlign: 'center', lineHeight: 1.6 }}>
              사은품 설정 정보를 불러오지 못했습니다.<br />어드민에서 먼저 사은품 설정을 저장해주세요.
              <div>
                <button onClick={handleLoad} style={{ marginTop: 10, background: 'none', border: 'none', color: COLOR.textPrimary, fontSize: 12, textDecoration: 'underline', cursor: 'pointer', fontWeight: 700 }}>다시 시도</button>
              </div>
            </div>
          )}

          {loaded && (
            <>
              {/* 상단 배너 — 어드민이 배너 기능을 켜뒀을 때만(gift.banner_text 존재) 입력창 노출, 문구는 매니저가 직접 작성 */}
              {!!gift.banner_text && (
                <div style={fieldBox}>
                  <label style={labelStyle}>상단 배너 문구 (자유롭게 수정해서 사용하세요)</label>
                  <input
                    className="bp-input"
                    value={bannerTextInput}
                    onChange={e => setBannerTextInput(e.target.value)}
                    placeholder="예: 홍길동 매니저님이 드리는 혜택"
                    style={inputStyle}
                  />
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 8, fontSize: 12, color: COLOR.textSecondary, cursor: 'pointer' }}>
                    <input
                      type="checkbox"
                      checked={bannerVisible}
                      onChange={e => setBannerVisible(e.target.checked)}
                    />
                    상단 배너 표시하기 (체크/문구 수정 시 바로 미리보기에 반영됩니다)
                  </label>
                </div>
              )}

              <div style={fieldBox}>
                <label style={labelStyle}>쿠폰 발행 건수 (최대 {MAX_ISSUE_COUNT}건)</label>
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    className="bp-input"
                    type="number"
                    min={1}
                    max={MAX_ISSUE_COUNT}
                    inputMode="numeric"
                    value={issueCountDraft}
                    onChange={e => onIssueCountChange(e.target.value)}
                    onFocus={e => e.target.select()}
                    style={{ ...inputStyle, flex: 1 }}
                  />
                  <button
                    onClick={applyIssueCount}
                    className="bp-primary-btn"
                    style={{
                      flexShrink: 0, padding: '0 20px', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer',
                      fontFamily: 'var(--font-noto-sans-kr), sans-serif', border: 'none',
                      background: issueCountApplied ? '#F1F1EF' : COLOR.ink,
                      color: issueCountApplied ? COLOR.textMuted : '#fff',
                    }}
                  >
                    확인
                  </button>
                </div>
                {!issueCountApplied && (
                  <div style={{
                    marginTop: 8, fontSize: 11, color: COLOR.peachText, lineHeight: 1.6,
                    background: COLOR.peachBg, border: `1px solid ${COLOR.peachBorder}`, borderRadius: 8, padding: '6px 10px',
                  }}>
                    [확인]을 눌러야 쿠폰번호 입력칸에 반영됩니다.
                  </div>
                )}
                {issueCountApplied && couponNumbersDraft.length > 1 && (
                  <div style={{
                    marginTop: 8, fontSize: 11, color: COLOR.textSecondary, lineHeight: 1.6,
                    background: '#F5F5F3', borderRadius: 8, padding: '6px 10px',
                  }}>
                    여러 장을 동시에 생성하면 쿠폰번호를 제외한 등록기간·교환처·사용방법 등 모든 내용이 동일하게 적용됩니다.
                  </div>
                )}
              </div>

              {couponNumbersDraft.map((cn, i) => (
                <div key={i} style={fieldBox}>
                  <label style={labelStyle}>
                    쿠폰번호{couponNumbersDraft.length > 1 ? ` ${i + 1}` : ''} (17자리)
                  </label>
                  <input
                    className="bp-input"
                    value={cn}
                    onChange={e => onCouponChange(i, e.target.value)}
                    placeholder="예: M59D5A525F9462606"
                    style={{ ...inputStyle, fontFamily: 'var(--font-mono, monospace)', letterSpacing: '0.02em' }}
                  />
                </div>
              ))}

              <div style={fieldBox}>
                <label style={labelStyle}>등록기간 (필수)</label>
                {gift.period_options.length > 0 ? (
                  <select className="bp-input" value={selectedPeriodIdxDraft} onChange={e => onPeriodChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">선택해주세요</option>
                    {gift.period_options.map((entry, i) => (
                      <option key={i} value={String(i)}>{entry.code} {entry.code && entry.period ? '·' : ''} {entry.period}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: 12, color: COLOR.textMuted }}>어드민에 등록된 등록기간이 없습니다</div>
                )}
              </div>

              <div style={fieldBox}>
                <label style={labelStyle}>교환처</label>
                <input className="bp-input" value={exchangePlaceDraft} onChange={e => onExchangeChange(e.target.value)} style={inputStyle} />
              </div>
              <div style={fieldBox}>
                <label style={labelStyle}>사용방법</label>
                <textarea className="bp-input" value={usageMethodDraft} onChange={e => onUsageChange(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
              </div>

              {extraItemsDraft.map((item, i) => (
                <div key={i} style={fieldBox}>
                  <label style={labelStyle}>{item.label || `추가 항목 ${i + 1}`}</label>
                  <textarea className="bp-input" value={item.content} onChange={e => updateExtraItemDraft(i, e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
                </div>
              ))}

              {issueCountApplied && couponNumbersDraft.length > 1 && (
                <div style={{ marginBottom: 18, padding: '10px 14px', background: '#F5F5F3', borderRadius: 10, fontSize: 11, color: COLOR.textSecondary, lineHeight: 1.6 }}>
                  쿠폰 동시 생성 시, 쿠폰번호를 제외한 등록기간 · 교환처 · 사용방법 등 모든 내용은 동일하게 생성되니 유의해주세요.
                </div>
              )}

              <button
                onClick={reflectToImage}
                className="bp-primary-btn"
                style={{
                  width: '100%', padding: 14, background: COLOR.ink, border: 'none', color: '#fff',
                  borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                  fontFamily: 'var(--font-noto-sans-kr), sans-serif', marginTop: 4,
                }}
              >
                이미지에 반영하기
              </button>

              {reflected && (
                <div style={{
                  marginTop: 12, fontSize: 12, color: COLOR.mintText, fontWeight: 700, textAlign: 'center',
                  background: COLOR.mintBg, border: `1px solid ${COLOR.mintBorder}`, borderRadius: 10, padding: '8px 12px',
                }}>
                  반영 완료 — 미리보기 탭에서 화살표로 넘겨가며 저장해주세요
                </div>
              )}
            </>
          )}
        </div>

        {/* 미리보기 영역 */}
        <div
          className={activeTab === 'preview' ? 'flex' : 'hidden'}
          style={{ flexDirection: 'column', alignItems: 'center' }}
        >

          <div style={{
            padding: 24, background: '#EFEFED', borderRadius: 24, display: 'flex', justifyContent: 'center', width: '100%', boxSizing: 'border-box',
          }}>
            <div ref={cardRef} style={{ width: 320, borderRadius: 20, overflow: 'hidden', position: 'relative', background: gift.background_color || '#FFF3D6', boxShadow: '0 8px 24px rgba(0,0,0,0.08)' }}>

              {/* 상단 배너 (매니저가 직접 작성한 문구 / 체크박스로 즉시 켜고 끌 수 있음) */}
              {bannerVisible && !!bannerTextInput.trim() && (
                <div style={{
                  padding: '12px 16px',
                  fontSize: 13,
                  fontWeight: 700,
                  textAlign: 'center',
                  color: COLOR.textPrimary,
                  background: 'rgba(255,255,255,0.55)',
                }}>
                  🎁 {bannerTextInput}
                </div>
              )}

              {/* 상단 템플릿 이미지 (정사각/원본 비율 그대로) */}
              <div style={{ padding: '20px 16px 30px', display: 'flex', justifyContent: 'center' }}>
                {gift.template_image_url ? (
                  <img
                    src={gift.template_image_url}
                    crossOrigin="anonymous"
                    alt="상품권"
                    style={{ width: '100%', maxHeight: 300, objectFit: 'contain', borderRadius: 12 }}
                  />
                ) : (
                  <div style={{
                    width: '100%', height: 220, borderRadius: 12,
                    border: '2px dashed rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center',
                    color: 'rgba(0,0,0,0.4)', fontSize: 13, textAlign: 'center', padding: 16,
                  }}>
                    어드민에서<br />상단 이미지를<br />등록해주세요
                  </div>
                )}
              </div>

              {/* 상단/하단 경계 - 은은한 점선 절취선 */}
              <div style={{ position: 'relative', height: 0 }}>
                <div style={{ position: 'absolute', left: 24, right: 24, top: 0, borderTop: '1.5px dashed rgba(0,0,0,0.18)' }} />
              </div>

              {/* 하단 정보 영역 (흰색) */}
              <div style={{ background: '#fff' }}>
                <div style={{ padding: '16px 16px 6px' }}>
                  <span style={{ fontSize: 12, fontWeight: 700, color: COLOR.mintText }}>{gift.brand_name || '브랜드명'}</span>
                </div>
                <div style={{ padding: '0 16px 16px', fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>
                  {gift.product_name || '상품명'} {gift.amount_text}
                </div>

                {/* 쿠폰번호 박스 (캡처 대상 - 여기엔 버튼/화살표를 넣지 않음) */}
                <div style={{ padding: '0 16px 18px', display: 'flex', justifyContent: 'center' }}>
                  <div style={{
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    minHeight: 52, padding: '0 16px', background: '#f7f7f8',
                    border: '1px solid #e6e6e8', borderRadius: 10,
                    fontFamily: 'monospace', fontSize: 15, fontWeight: 700, letterSpacing: '0.14em', lineHeight: 1,
                    color: '#1a1a2e', whiteSpace: 'nowrap', maxWidth: '100%', boxSizing: 'border-box',
                  }}>
                    {couponNumbers[previewIndex] || 'M59D5A525F9462606'}
                  </div>
                </div>

                <div style={{ borderTop: '1px solid #eee' }}>
                  <div style={{ display: 'flex', borderBottom: '1px solid #f2f2f2' }}>
                    <div style={{ flex: '0 0 90px', padding: '10px 14px', fontSize: 12, color: '#999', background: '#fafafa' }}>교환처</div>
                    <div style={{ flex: 1, padding: '10px 14px', fontSize: 12, color: '#333', textAlign: 'right' }}>{exchangePlace || '-'}</div>
                  </div>
                  <div style={{ display: 'flex', borderBottom: '1px solid #f2f2f2' }}>
                    <div style={{ flex: '0 0 90px', padding: '10px 14px', fontSize: 12, color: '#999', background: '#fafafa' }}>등록기간</div>
                    <div style={{ flex: 1, padding: '10px 14px', fontSize: 12, color: '#333', textAlign: 'right' }}>{selectedPeriod?.period || '-'}</div>
                  </div>
                </div>

                {extraItems.filter(it => it.content.trim()).map((item, i) => (
                  <div key={i} style={{ display: 'flex', borderTop: '1px solid #f2f2f2' }}>
                    <div style={{ flex: '0 0 90px', padding: '10px 14px', fontSize: 12, color: '#999', background: '#fafafa' }}>{item.label}</div>
                    <div style={{ flex: 1, padding: '10px 14px', fontSize: 12, color: '#333', textAlign: 'right', whiteSpace: 'pre-wrap' }}>{item.content}</div>
                  </div>
                ))}

                {usageMethod && (
                  <div style={{ padding: '12px 16px', fontSize: 11, color: '#888', lineHeight: 1.6, whiteSpace: 'pre-wrap', borderTop: '1px solid #eee' }}>
                    {usageMethod}
                  </div>
                )}

                {gift.bottom_image_url && (
                  <div style={{ padding: '16px', display: 'flex', justifyContent: 'center', borderTop: '1px solid #eee' }}>
                    <img src={gift.bottom_image_url} crossOrigin="anonymous" alt="BI" style={{ maxHeight: 40, objectFit: 'contain' }} />
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 미리보기 넘기기 + 저장 버튼 (카드 바로 아래, 캡처 대상 밖) */}
          {reflected && (
            <div style={{ width: 320, marginTop: 18 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                {isMulti && (
                  <button
                    onClick={() => setPreviewIndex(p => Math.max(0, p - 1))}
                    disabled={previewIndex === 0 || capturing}
                    className="bp-ghost-btn"
                    style={{ ...navBtnStyle, opacity: previewIndex === 0 ? 0.35 : 1 }}
                  >‹</button>
                )}

                <button
                  onClick={saveCurrentImage}
                  disabled={capturing}
                  className="bp-primary-btn"
                  style={{
                    flex: 1, padding: 13,
                    background: savedFlags[previewIndex] ? COLOR.mintBg : COLOR.ink,
                    color: savedFlags[previewIndex] ? COLOR.mintText : '#fff',
                    border: savedFlags[previewIndex] ? `1.5px solid ${COLOR.mintBorder}` : 'none',
                    borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'var(--font-noto-sans-kr), sans-serif',
                  }}
                >
                  {capturing ? '저장 중...' : savedFlags[previewIndex] ? '✓ 다시 저장하기' : '이 쿠폰 이미지 저장하기'}
                </button>

                {isMulti && (
                  <button
                    onClick={() => setPreviewIndex(p => Math.min(couponNumbers.length - 1, p + 1))}
                    disabled={previewIndex === couponNumbers.length - 1 || capturing}
                    className="bp-ghost-btn"
                    style={{ ...navBtnStyle, opacity: previewIndex === couponNumbers.length - 1 ? 0.35 : 1 }}
                  >›</button>
                )}
              </div>

              {isMulti && (
                <div style={{ textAlign: 'center', marginTop: 10, fontSize: 11, color: COLOR.textMuted, fontWeight: 700 }}>
                  {previewIndex + 1} / {couponNumbers.length}
                  {savedFlags[previewIndex] && <span style={{ color: COLOR.mintText }}> · 저장됨</span>}
                  <span style={{ margin: '0 6px', color: COLOR.border }}>|</span>
                  <span style={{ color: allSaved ? COLOR.mintText : COLOR.textMuted }}>
                    {allSaved ? `전체 저장 완료` : `전체 저장 ${savedCount} / ${couponNumbers.length}`}
                  </span>
                </div>
              )}

              {allSaved && (
                <button
                  onClick={resetGeneration}
                  className="bp-ghost-btn"
                  style={{ width: '100%', padding: 12, marginTop: 14, background: COLOR.surface, border: `1.5px solid ${COLOR.border}`, color: COLOR.textSecondary, borderRadius: 12, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}
                >
                  새로운 쿠폰 등록하기
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}