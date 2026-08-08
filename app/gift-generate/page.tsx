'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import html2canvas from 'html2canvas'

interface NoticeItem { label: string; content: string }
interface PeriodEntry { code: string; period: string }

type GiftSettings = {
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

const emptyGift: GiftSettings = {
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

export default function GiftGeneratePage() {
  const [gift, setGift] = useState<GiftSettings>({ ...emptyGift })
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // ---- 입력값 (임시 상태 / draft) ----
  const [issueCountDraft, setIssueCountDraft] = useState('1')
  const [couponNumbersDraft, setCouponNumbersDraft] = useState<string[]>([''])
  const [selectedPeriodIdxDraft, setSelectedPeriodIdxDraft] = useState('')
  const [usageMethodDraft, setUsageMethodDraft] = useState('')
  const [exchangePlaceDraft, setExchangePlaceDraft] = useState('')
  const [extraItemsDraft, setExtraItemsDraft] = useState<NoticeItem[]>([])

  // ---- 미리보기(카드)에 실제로 반영된 값 ----
  const [couponNumbers, setCouponNumbers] = useState<string[]>([''])
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState('')
  const [usageMethod, setUsageMethod] = useState('')
  const [exchangePlace, setExchangePlace] = useState('')
  const [extraItems, setExtraItems] = useState<NoticeItem[]>([])
  const [previewIndex, setPreviewIndex] = useState(0) // 지금 카드에 보여지는 쿠폰 순번 (자유롭게 이동 가능)
  const [savedFlags, setSavedFlags] = useState<boolean[]>([false])

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
    setSelectedPeriodIdxDraft(g.period_options.length > 0 ? '0' : '')

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

  // draft 값이 바뀌면 "반영 완료" 상태를 해제 (재확인 유도)
  function onIssueCountChange(v: string) {
    const raw = Number(v)
    const n = Number.isFinite(raw) ? Math.max(1, Math.min(MAX_ISSUE_COUNT, Math.floor(raw))) : 1
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
    setCouponNumbers([...couponNumbersDraft])
    setSelectedPeriodIdx(selectedPeriodIdxDraft)
    setUsageMethod(usageMethodDraft)
    setExchangePlace(exchangePlaceDraft)
    setExtraItems(extraItemsDraft.map(it => ({ ...it })))
    setPreviewIndex(0)
    setSavedFlags(new Array(couponNumbersDraft.length).fill(false))
    setReflected(true)
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
    setCouponNumbersDraft([''])
    setSelectedPeriodIdxDraft(gift.period_options.length > 0 ? '0' : '')
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
  }

  const isMulti = couponNumbers.length > 1
  const allSaved = reflected && savedFlags.length > 0 && savedFlags.every(Boolean)
  const savedCount = savedFlags.filter(Boolean).length

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6, display: 'block' }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid #ddd', borderRadius: 8,
    outline: 'none', fontFamily: 'var(--font-noto-sans-kr), sans-serif', boxSizing: 'border-box',
  }
  const fieldBox: React.CSSProperties = { marginBottom: 16 }
  const navBtnStyle: React.CSSProperties = {
    width: 32, height: 32, borderRadius: '50%', border: '1.5px solid #ddd', background: '#fff',
    fontSize: 16, color: '#555', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', fontFamily: 'var(--font-noto-sans-kr), sans-serif', background: '#FFF7EC', minHeight: '100vh' }}>

      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>
        🎁 모바일 기프티콘 이미지 생성
      </h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>정보를 입력한 뒤 [이미지에 반영하기]로 미리보기를 확인하고, 각 쿠폰을 화살표로 넘겨가며 저장하세요.</p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>

        {/* 입력 영역 */}
        <div style={{ flex: '1 1 320px', background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>

          {!loaded && !loadError && (
            <div style={{ fontSize: 13, color: '#aaa', padding: '20px 0', textAlign: 'center' }}>불러오는 중...</div>
          )}

          {loadError && (
            <div style={{ fontSize: 13, color: '#e74c3c', padding: '16px 0', textAlign: 'center' }}>
              사은품 설정 정보를 불러오지 못했습니다.<br />어드민에서 먼저 사은품 설정을 저장해주세요.
              <div>
                <button onClick={handleLoad} style={{ marginTop: 10, background: 'none', border: 'none', color: '#ff9800', fontSize: 12, textDecoration: 'underline', cursor: 'pointer' }}>다시 시도</button>
              </div>
            </div>
          )}

          {loaded && (
            <>
              <div style={fieldBox}>
                <label style={labelStyle}>쿠폰 발행 건수 (최대 {MAX_ISSUE_COUNT}건)</label>
                <input
                  type="number"
                  min={1}
                  max={MAX_ISSUE_COUNT}
                  value={issueCountDraft}
                  onChange={e => onIssueCountChange(e.target.value)}
                  style={inputStyle}
                />
                {Number(issueCountDraft) > 1 && (
                  <div style={{ marginTop: 6, fontSize: 11, color: '#ff9800', lineHeight: 1.5 }}>
                    ⚠ 여러 장을 동시에 생성하면 쿠폰번호를 제외한 등록기간·교환처·사용방법 등 모든 내용이 동일하게 적용됩니다.
                  </div>
                )}
              </div>

              {couponNumbersDraft.map((cn, i) => (
                <div key={i} style={fieldBox}>
                  <label style={labelStyle}>
                    쿠폰번호{couponNumbersDraft.length > 1 ? ` ${i + 1}` : ''} (17자리)
                  </label>
                  <input
                    value={cn}
                    onChange={e => onCouponChange(i, e.target.value)}
                    placeholder="예: M59D5A525F9462606"
                    style={{ ...inputStyle, fontFamily: 'monospace' }}
                  />
                </div>
              ))}

              <div style={fieldBox}>
                <label style={labelStyle}>등록기간</label>
                {gift.period_options.length > 0 ? (
                  <select value={selectedPeriodIdxDraft} onChange={e => onPeriodChange(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
                    <option value="">선택해주세요</option>
                    {gift.period_options.map((entry, i) => (
                      <option key={i} value={String(i)}>{entry.code} {entry.code && entry.period ? '·' : ''} {entry.period}</option>
                    ))}
                  </select>
                ) : (
                  <div style={{ fontSize: 12, color: '#bbb' }}>어드민에 등록된 등록기간이 없습니다</div>
                )}
              </div>

              <div style={fieldBox}>
                <label style={labelStyle}>교환처</label>
                <input value={exchangePlaceDraft} onChange={e => onExchangeChange(e.target.value)} style={inputStyle} />
              </div>
              <div style={fieldBox}>
                <label style={labelStyle}>사용방법</label>
                <textarea value={usageMethodDraft} onChange={e => onUsageChange(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
              </div>

              {extraItemsDraft.map((item, i) => (
                <div key={i} style={fieldBox}>
                  <label style={labelStyle}>{item.label || `추가 항목 ${i + 1}`}</label>
                  <textarea value={item.content} onChange={e => updateExtraItemDraft(i, e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
                </div>
              ))}

              {Number(issueCountDraft) > 1 && (
                <div style={{ marginBottom: 16, padding: '10px 12px', background: '#fff7ec', border: '1px solid #ffe0b3', borderRadius: 8, fontSize: 11, color: '#c77700', lineHeight: 1.6 }}>
                  ※ 쿠폰 동시 생성 시, 쿠폰번호를 제외한 등록기간 · 교환처 · 사용방법 등 모든 내용은 동일하게 생성되니 유의해주세요.
                </div>
              )}

              <button
                onClick={reflectToImage}
                style={{ width: '100%', padding: 12, background: '#fff', border: '1.5px solid #ff9800', color: '#ff9800', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif', marginTop: 4 }}
              >
                📌 이미지에 반영하기
              </button>

              {reflected && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#2e9c4b', fontWeight: 700, textAlign: 'center' }}>
                  ✓ 반영 완료 — 아래 미리보기에서 화살표로 넘겨가며 저장해주세요
                </div>
              )}
            </>
          )}
        </div>

        {/* 미리보기 영역 */}
        <div style={{ flex: '1 1 300px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>

          <div ref={cardRef} style={{ width: 320, borderRadius: 20, overflow: 'hidden', position: 'relative', background: gift.background_color || '#FFF3D6' }}>

            {/* 상단 템플릿 이미지 (컬러 배경 영역) - 카드 너비에 꽉 차는 사각형 */}
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
                <span style={{ fontSize: 12, fontWeight: 700, color: '#ff9800' }}>{gift.brand_name || '브랜드명'}</span>
              </div>
              <div style={{ padding: '0 16px 16px', fontSize: 14, fontWeight: 700, color: '#1a1a2e' }}>
                {gift.product_name || '상품명'} {gift.amount_text}
              </div>

              {/* 쿠폰번호 박스 (캡처 대상 - 여기엔 버튼/화살표를 넣지 않음) */}
              <div style={{ padding: '0 16px 18px', display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: 46, padding: '0 18px', background: '#f7f7f8',
                  border: '1px solid #e6e6e8', borderRadius: 10,
                  fontFamily: 'monospace', fontSize: 16, fontWeight: 700, letterSpacing: 1, lineHeight: 1,
                  color: '#1a1a2e', wordBreak: 'break-all', maxWidth: '100%', boxSizing: 'border-box',
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

          {/* 미리보기 넘기기 + 저장 버튼 (카드 바로 아래, 캡처 대상 밖) */}
          {reflected && (
            <div style={{ width: 320, marginTop: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, justifyContent: 'center' }}>
                {isMulti && (
                  <button
                    onClick={() => setPreviewIndex(p => Math.max(0, p - 1))}
                    disabled={previewIndex === 0 || capturing}
                    style={{ ...navBtnStyle, opacity: previewIndex === 0 ? 0.35 : 1 }}
                  >‹</button>
                )}

                <button
                  onClick={saveCurrentImage}
                  disabled={capturing}
                  style={{
                    flex: 1, padding: 12,
                    background: savedFlags[previewIndex] ? '#fff' : 'linear-gradient(135deg, #ff9800, #f57c00)',
                    color: savedFlags[previewIndex] ? '#ff9800' : '#fff',
                    border: savedFlags[previewIndex] ? '1.5px solid #ff9800' : 'none',
                    borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                    fontFamily: 'var(--font-noto-sans-kr), sans-serif',
                  }}
                >
                  {capturing ? '저장 중...' : savedFlags[previewIndex] ? '✓ 다시 저장하기' : '🖼 이 쿠폰 이미지 저장하기'}
                </button>

                {isMulti && (
                  <button
                    onClick={() => setPreviewIndex(p => Math.min(couponNumbers.length - 1, p + 1))}
                    disabled={previewIndex === couponNumbers.length - 1 || capturing}
                    style={{ ...navBtnStyle, opacity: previewIndex === couponNumbers.length - 1 ? 0.35 : 1 }}
                  >›</button>
                )}
              </div>

              {isMulti && (
                <div style={{ textAlign: 'center', marginTop: 8, fontSize: 11, color: '#999', fontWeight: 700 }}>
                  {previewIndex + 1} / {couponNumbers.length}
                  {savedFlags[previewIndex] && <span style={{ color: '#2e9c4b' }}> · ✓ 저장됨</span>}
                  <span style={{ margin: '0 6px', color: '#ddd' }}>|</span>
                  <span style={{ color: allSaved ? '#2e9c4b' : '#aaa' }}>
                    {allSaved ? `✅ 전체 저장 완료` : `전체 저장 ${savedCount} / ${couponNumbers.length}`}
                  </span>
                </div>
              )}

              {allSaved && (
                <button
                  onClick={resetGeneration}
                  style={{ width: '100%', padding: 12, marginTop: 12, background: '#fff', border: '1.5px solid #ddd', color: '#888', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}
                >
                  🔄 새로운 쿠폰 등록하기
                </button>
              )}

              {!isMulti && savedFlags[0] && (
                <button
                  onClick={resetGeneration}
                  style={{ width: '100%', padding: 12, marginTop: 12, background: '#fff', border: '1.5px solid #ddd', color: '#888', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}
                >
                  🔄 새로운 쿠폰 등록하기
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}