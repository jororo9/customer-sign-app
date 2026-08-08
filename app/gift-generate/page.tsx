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

// 17자리, 띄어쓰기 없이 영문/숫자만
function sanitizeCouponNumber(raw: string) {
  return raw.replace(/[^0-9a-zA-Z]/g, '').slice(0, 17)
}

export default function GiftGeneratePage() {
  const [gift, setGift] = useState<GiftSettings>({ ...emptyGift })
  const [loaded, setLoaded] = useState(false)
  const [loadError, setLoadError] = useState(false)

  // ---- 입력값 (임시 상태 / draft) ----
  const [couponNumberDraft, setCouponNumberDraft] = useState('')
  const [selectedPeriodIdxDraft, setSelectedPeriodIdxDraft] = useState('')
  const [usageMethodDraft, setUsageMethodDraft] = useState('')
  const [exchangePlaceDraft, setExchangePlaceDraft] = useState('')
  const [extraItemsDraft, setExtraItemsDraft] = useState<NoticeItem[]>([])

  // ---- 미리보기(카드)에 실제로 반영된 값 ----
  const [couponNumber, setCouponNumber] = useState('')
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState('')
  const [usageMethod, setUsageMethod] = useState('')
  const [exchangePlace, setExchangePlace] = useState('')
  const [extraItems, setExtraItems] = useState<NoticeItem[]>([])

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
  function onCouponChange(v: string) { setCouponNumberDraft(sanitizeCouponNumber(v)); setReflected(false) }
  function onPeriodChange(v: string) { setSelectedPeriodIdxDraft(v); setReflected(false) }
  function onExchangeChange(v: string) { setExchangePlaceDraft(v); setReflected(false) }
  function onUsageChange(v: string) { setUsageMethodDraft(v); setReflected(false) }

  function reflectToImage() {
    if (!couponNumberDraft.trim()) {
      alert('쿠폰번호를 입력해주세요.')
      return
    }
    if (couponNumberDraft.length !== 17) {
      alert('쿠폰번호는 17자리입니다. 확인해주세요.')
      return
    }
    setCouponNumber(couponNumberDraft)
    setSelectedPeriodIdx(selectedPeriodIdxDraft)
    setUsageMethod(usageMethodDraft)
    setExchangePlace(exchangePlaceDraft)
    setExtraItems(extraItemsDraft.map(it => ({ ...it })))
    setReflected(true)
  }

  const selectedPeriod: PeriodEntry | null =
    selectedPeriodIdx !== '' && gift.period_options[Number(selectedPeriodIdx)]
      ? gift.period_options[Number(selectedPeriodIdx)]
      : null

  async function generateImage() {
    if (!reflected) {
      alert('먼저 "이미지에 반영하기" 버튼을 눌러 미리보기에 반영해주세요.')
      return
    }
    if (!cardRef.current) return

    setCapturing(true)
    await document.fonts.ready
    // 템플릿 이미지가 있다면 로딩이 끝날 때까지 대기
    const imgs = cardRef.current.querySelectorAll('img')
    await Promise.all(Array.from(imgs).map(img => {
      if (img.complete) return Promise.resolve()
      return new Promise(res => { img.onload = res; img.onerror = res })
    }))
    await new Promise(r => setTimeout(r, 300))

    const canvas = await html2canvas(cardRef.current, {
      scale: 3, backgroundColor: '#ffffff', useCORS: true, logging: false, allowTaint: true,
    })
    setCapturing(false)

    const link = document.createElement('a')
    link.download = `기프티콘_${couponNumber || Date.now()}.jpg`
    link.href = canvas.toDataURL('image/jpeg', 0.95)
    link.click()
  }

  const labelStyle: React.CSSProperties = { fontSize: 12, fontWeight: 700, color: '#555', marginBottom: 6, display: 'block' }
  const inputStyle: React.CSSProperties = {
    width: '100%', padding: '10px 12px', fontSize: 14, border: '1.5px solid #ddd', borderRadius: 8,
    outline: 'none', fontFamily: 'var(--font-noto-sans-kr), sans-serif', boxSizing: 'border-box',
  }
  const fieldBox: React.CSSProperties = { marginBottom: 16 }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '24px 16px', fontFamily: 'var(--font-noto-sans-kr), sans-serif', background: '#FFF7EC', minHeight: '100vh' }}>

      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>
        🎁 모바일 기프티콘 이미지 생성
      </h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>정보를 입력한 뒤 [이미지에 반영하기]로 미리보기를 확인하고, 이미지를 생성해 고객에게 전달하세요.</p>

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
                <label style={labelStyle}>쿠폰번호 (17자리)</label>
                <input
                  value={couponNumberDraft}
                  onChange={e => onCouponChange(e.target.value)}
                  placeholder="예: M59D5A525F9462606"
                  style={{ ...inputStyle, fontFamily: 'monospace' }}
                />
              </div>

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

              <button
                onClick={reflectToImage}
                style={{ width: '100%', padding: 12, background: '#fff', border: '1.5px solid #ff9800', color: '#ff9800', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif', marginTop: 4 }}
              >
                📌 이미지에 반영하기
              </button>

              {reflected && (
                <div style={{ marginTop: 10, fontSize: 12, color: '#2e9c4b', fontWeight: 700, textAlign: 'center' }}>
                  ✓ 반영 완료 — 미리보기를 확인하고 이미지 생성 버튼을 눌러주세요
                </div>
              )}

              {reflected && (
                <button
                  onClick={generateImage}
                  style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #ff9800, #f57c00)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif', boxShadow: '0 4px 12px rgba(255,152,0,0.3)', marginTop: 12 }}
                >
                  {capturing ? '생성 중...' : '🖼 이미지 생성하기 (JPG 저장)'}
                </button>
              )}
            </>
          )}
        </div>

        {/* 미리보기 영역 */}
        <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
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

              {/* 쿠폰번호 박스 */}
              <div style={{ padding: '0 16px 18px', display: 'flex', justifyContent: 'center' }}>
                <div style={{
                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                  minHeight: 46, padding: '0 18px', background: '#f7f7f8',
                  border: '1px solid #e6e6e8', borderRadius: 10,
                  fontFamily: 'monospace', fontSize: 16, fontWeight: 700, letterSpacing: 1, lineHeight: 1,
                  color: '#1a1a2e', wordBreak: 'break-all', maxWidth: '100%', boxSizing: 'border-box',
                }}>
                  {couponNumber || 'M59D5A525F9462606'}
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
      </div>
    </div>
  )
}