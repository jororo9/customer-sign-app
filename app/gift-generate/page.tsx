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
  const [loading, setLoading] = useState(false)

  const [couponNumber, setCouponNumber] = useState('')
  const [selectedPeriodIdx, setSelectedPeriodIdx] = useState('')
  const [usageMethod, setUsageMethod] = useState('')
  const [exchangePlace, setExchangePlace] = useState('')
  const [extraItems, setExtraItems] = useState<NoticeItem[]>([])

  const [capturing, setCapturing] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  useEffect(() => { handleLoad(true) }, [])

  async function handleLoad(silent = false) {
    setLoading(true)
    const { data: row, error } = await supabase.from('gift_settings').select('*').eq('id', 1).maybeSingle()
    if (error || !row) {
      if (!silent) alert('사은품 설정 정보를 불러오지 못했습니다. 어드민에서 먼저 사은품 설정을 저장해주세요.')
      setLoading(false)
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
    setUsageMethod(g.usage_method)
    setExchangePlace(g.exchange_place)
    setExtraItems(g.extra_items.map((it: NoticeItem) => ({ ...it })))
    setSelectedPeriodIdx(g.period_options.length > 0 ? '0' : '')
    setLoaded(true)
    setLoading(false)
  }

  function updateExtraItemContent(i: number, value: string) {
    setExtraItems(prev => {
      const next = [...prev]
      next[i] = { ...next[i], content: value }
      return next
    })
  }

  const selectedPeriod: PeriodEntry | null =
    selectedPeriodIdx !== '' && gift.period_options[Number(selectedPeriodIdx)]
      ? gift.period_options[Number(selectedPeriodIdx)]
      : null

  async function generateImage() {
    if (!couponNumber.trim()) {
      alert('쿠폰번호를 입력해주세요.')
      return
    }
    if (!loaded) {
      alert('먼저 "등록기간 등 불러오기"를 눌러 사은품 정보를 불러와주세요.')
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

      <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e', marginBottom: 4 }}>🎁 모바일 기프티콘 생성</h1>
      <p style={{ fontSize: 13, color: '#888', marginBottom: 24 }}>쿠폰번호를 입력하고 정보를 불러온 뒤, 이미지를 생성해 고객에게 전달하세요.</p>

      <div style={{ display: 'flex', gap: 24, flexWrap: 'wrap' }}>

        {/* 입력 영역 */}
        <div style={{ flex: '1 1 320px', background: '#fff', borderRadius: 14, padding: 24, boxShadow: '0 4px 20px rgba(0,0,0,0.06)' }}>

          <div style={fieldBox}>
            <label style={labelStyle}>쿠폰번호 (17자리)</label>
            <input
              value={couponNumber}
              onChange={e => setCouponNumber(sanitizeCouponNumber(e.target.value))}
              placeholder="예: M59D5A525F9462606"
              style={{ ...inputStyle, fontFamily: 'monospace' }}
            />
          </div>

          <button
            onClick={() => handleLoad(false)}
            disabled={loading}
            style={{ width: '100%', padding: 12, background: '#fff', border: '1.5px solid #ff9800', color: '#ff9800', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif', marginBottom: 20 }}
          >
            {loading ? '불러오는 중...' : loaded ? '↻ 다시 불러오기' : '📥 등록기간 등 불러오기'}
          </button>

          {loaded && (
            <>
              <div style={fieldBox}>
                <label style={labelStyle}>등록기간</label>
                {gift.period_options.length > 0 ? (
                  <select value={selectedPeriodIdx} onChange={e => setSelectedPeriodIdx(e.target.value)} style={{ ...inputStyle, cursor: 'pointer' }}>
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
                <input value={exchangePlace} onChange={e => setExchangePlace(e.target.value)} style={inputStyle} />
              </div>
              <div style={fieldBox}>
                <label style={labelStyle}>사용방법</label>
                <textarea value={usageMethod} onChange={e => setUsageMethod(e.target.value)} rows={3} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
              </div>

              {extraItems.map((item, i) => (
                <div key={i} style={fieldBox}>
                  <label style={labelStyle}>{item.label || `추가 항목 ${i + 1}`}</label>
                  <textarea value={item.content} onChange={e => updateExtraItemContent(i, e.target.value)} rows={2} style={{ ...inputStyle, resize: 'vertical', lineHeight: 1.6 }} />
                </div>
              ))}

              <button
                onClick={generateImage}
                style={{ width: '100%', padding: 14, background: 'linear-gradient(135deg, #ff9800, #f57c00)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif', boxShadow: '0 4px 12px rgba(255,152,0,0.3)', marginTop: 8 }}
              >
                🖼 이미지 생성하기 (JPG 저장)
              </button>
            </>
          )}
        </div>

        {/* 미리보기 영역 */}
        <div style={{ flex: '1 1 300px', display: 'flex', justifyContent: 'center' }}>
          <div ref={cardRef} style={{ width: 320, borderRadius: 20, overflow: 'hidden', position: 'relative', background: gift.background_color || '#FFF3D6' }}>

            {/* 상단 템플릿 이미지 (컬러 배경 영역) */}
            <div style={{ padding: '24px 20px 34px', display: 'flex', justifyContent: 'center' }}>
              {gift.template_image_url ? (
                <img src={gift.template_image_url} crossOrigin="anonymous" alt="상품권" style={{ width: 220, height: 220, objectFit: 'contain' }} />
              ) : (
                <div style={{ width: 220, height: 220, borderRadius: '50%', border: '2px dashed rgba(0,0,0,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'rgba(0,0,0,0.4)', fontSize: 13, textAlign: 'center', padding: 16 }}>
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