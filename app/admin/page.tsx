'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface NoticeItem { label: string; content: string }
type CategoryData = {
  title: string
  items: NoticeItem[]
  confirm_text: string
  logo_url: string
  product_options: string[]
  period_options: string[]
}
interface PeriodEntry { code: string; period: string }
type GiftSettings = {
  page_title: string
  page_description: string
  banner_text: string
  template_image_url: string
  brand_name: string
  product_name: string
  amount_text: string
  period_options: PeriodEntry[]
  usage_method: string
  exchange_place: string
  extra_items: NoticeItem[]
  background_color: string
}

const CATEGORIES = [
  { key: 'infant', label: '유아' },
  { key: 'junior', label: '초중' },
]

const SECTIONS = [
  { key: 'notice', label: '📋 안내사항 설정' },
  { key: 'gift', label: '🎁 사은품 설정' },
  { key: 'promotion', label: '🏃 프로모션 현황' },
]

const defaultData: CategoryData = {
  title: '필수 안내사항 확인',
  items: [{ label: '', content: '' }],
  confirm_text: '위 안내사항을 모두 확인하였으며, 내용을 충분히 안내받았음을 확인합니다.',
  logo_url: '',
  product_options: [''],
  period_options: [''],
}

const defaultGift: GiftSettings = {
  page_title: 'B상품권 기프티콘 이미지 생성',
  page_description: '정보를 입력한 뒤 이미지에 반영하기로 미리보기를 확인하고, 쿠폰 이미지를 저장하세요',
  banner_text: '매니저님이 드리는 혜택',
  template_image_url: '',
  brand_name: '',
  product_name: '',
  amount_text: '',
  period_options: [{ code: '', period: '' }],
  usage_method: '',
  exchange_place: '',
  extra_items: [],
  background_color: '#FFF3D6',
}

// 공통 스타일
const sectionBox: React.CSSProperties = {
  marginBottom: 28, padding: 20, background: '#f8f9ff',
  border: '1.5px solid #d0d5f0', borderRadius: 10,
}
const sectionLabel: React.CSSProperties = {
  fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 12,
}
const optionInput: React.CSSProperties = {
  flex: 1, padding: '7px 10px', fontSize: 13,
  border: '1.5px solid #ddd', borderRadius: 6, outline: 'none',
  fontFamily: 'var(--font-noto-sans-kr), sans-serif',
}
const fullInput: React.CSSProperties = {
  width: '100%', padding: '9px 10px', fontSize: 13,
  border: '1.5px solid #ddd', borderRadius: 6, outline: 'none',
  fontFamily: 'var(--font-noto-sans-kr), sans-serif', boxSizing: 'border-box',
}
const addBtn: React.CSSProperties = {
  width: '100%', padding: 8, border: '1.5px dashed #ccc', borderRadius: 8,
  background: 'none', color: '#888', fontSize: 13, cursor: 'pointer',
  fontFamily: 'var(--font-noto-sans-kr), sans-serif', marginTop: 4,
}
const removeBtn: React.CSSProperties = {
  background: 'none', border: 'none', color: '#ccc', fontSize: 20, cursor: 'pointer',
}

export default function AdminPage() {
  const [section, setSection] = useState<'notice' | 'gift' | 'promotion'>('notice')

  return (
    <div style={{ width: '100%', minHeight: '100vh', background: '#EBF5FF' }}>
      <div style={{ maxWidth: 900, margin: '0 auto', padding: '30px 24px', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>

        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
          <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>어드민</h1>
          <div style={{ display: 'flex', gap: 8 }}>
            <a href="/consent" target="_blank" style={{ padding: '8px 16px', background: '#fff', border: '1.5px solid #1E90FF', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#1E90FF', textDecoration: 'none' }}>👁 고객 확인서</a>
            <a href="/gift-generate" target="_blank" style={{ padding: '8px 16px', background: '#fff', border: '1.5px solid #ff9800', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#ff9800', textDecoration: 'none' }}>🎁 기프티콘 생성</a>
            <a href="/promotion" target="_blank" style={{ padding: '8px 16px', background: '#fff', border: '1.5px solid #2ecc71', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#2ecc71', textDecoration: 'none' }}>🏃 프로모션 현황판</a>
          </div>
        </div>

        {/* 섹션 전환 탭 (안내사항 설정 / 사은품 설정 / 프로모션 현황) */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
          {SECTIONS.map(s => (
            <button key={s.key} onClick={() => setSection(s.key as 'notice' | 'gift' | 'promotion')}
              style={{
                padding: '10px 20px', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer',
                fontFamily: 'var(--font-noto-sans-kr), sans-serif',
                border: section === s.key ? '2px solid #1E90FF' : '2px solid transparent',
                background: section === s.key ? '#fff' : 'rgba(255,255,255,0.5)',
                color: section === s.key ? '#1E90FF' : '#888',
                boxShadow: section === s.key ? '0 4px 12px rgba(30,144,255,0.15)' : 'none',
              }}>
              {s.label}
            </button>
          ))}
        </div>

        {section === 'notice' ? <NoticeSettings /> : section === 'gift' ? <GiftSettingsPanel /> : <PromotionSettingsPanel />}
      </div>
    </div>
  )
}

// ============================================================
// 안내사항 설정 (기존 기능)
// ============================================================
function NoticeSettings() {
  const [tab, setTab] = useState('infant')
  const [data, setData] = useState<Record<string, CategoryData>>({
    infant: { ...defaultData, items: [...defaultData.items], product_options: [''], period_options: [''] },
    junior: { ...defaultData, items: [...defaultData.items], product_options: [''], period_options: [''] }
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: rows } = await supabase.from('consent_notices').select('*')
    if (!rows) return
    const next: Record<string, CategoryData> = {
      infant: { ...defaultData, items: [...defaultData.items], product_options: [''], period_options: [''] },
      junior: { ...defaultData, items: [...defaultData.items], product_options: [''], period_options: [''] }
    }
    rows.forEach(row => {
      if (row.category === 'infant' || row.category === 'junior') {
        next[row.category] = {
          title: row.title,
          items: row.items,
          confirm_text: row.confirm_text || defaultData.confirm_text,
          logo_url: row.logo_url || '',
          product_options: row.product_options || [''],
          period_options: row.period_options || [''],
        }
      }
    })
    setData(next)
  }

  function get<K extends keyof CategoryData>(field: K): CategoryData[K] {
    return data[tab][field]
  }

  function set<K extends keyof CategoryData>(field: K, value: CategoryData[K]) {
    setData(prev => ({ ...prev, [tab]: { ...prev[tab], [field]: value } }))
  }

  function addItem() { set('items', [...get('items'), { label: '', content: '' }]) }
  function removeItem(i: number) { set('items', get('items').filter((_: NoticeItem, idx: number) => idx !== i)) }
  function updateItem(i: number, field: keyof NoticeItem, value: string) {
    const next = [...get('items')]
    next[i] = { ...next[i], [field]: value }
    set('items', next)
  }

  function addProductOption() { set('product_options', [...(get('product_options') as string[]), '']) }
  function removeProductOption(i: number) {
    set('product_options', (get('product_options') as string[]).filter((_: string, idx: number) => idx !== i))
  }
  function updateProductOption(i: number, value: string) {
    const next = [...(get('product_options') as string[])]
    next[i] = value
    set('product_options', next)
  }

  function addPeriodOption() { set('period_options', [...(get('period_options') as string[]), '']) }
  function removePeriodOption(i: number) {
    set('period_options', (get('period_options') as string[]).filter((_: string, idx: number) => idx !== i))
  }
  function updatePeriodOption(i: number, value: string) {
    const next = [...(get('period_options') as string[])]
    next[i] = value
    set('period_options', next)
  }

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fileName = `${tab}_logo_${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage
      .from('consent-logos')
      .upload(fileName, file, { upsert: true })
    if (error) {
      alert('업로드 실패: ' + error.message)
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('consent-logos').getPublicUrl(fileName)
    set('logo_url', urlData.publicUrl)
    setUploading(false)
  }

  async function save() {
    setSaving(true)
    const id = tab === 'infant' ? 1 : 2
    await supabase.from('consent_notices').upsert({
      id, category: tab,
      title: get('title'),
      items: get('items'),
      confirm_text: get('confirm_text'),
      logo_url: get('logo_url'),
      product_options: get('product_options'),
      period_options: get('period_options'),
      updated_at: new Date().toISOString()
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', overflow: 'hidden' }}>

      {/* 탭 */}
      <div style={{ display: 'flex', borderBottom: '2px solid #f0f0f0' }}>
        {CATEGORIES.map(c => (
          <button key={c.key} onClick={() => setTab(c.key)} style={{ flex: 1, padding: 16, border: 'none', background: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', color: tab === c.key ? '#1E90FF' : '#aaa', borderBottom: tab === c.key ? '3px solid #1E90FF' : '3px solid transparent', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* 헤더 */}
      <div style={{ background: '#1E90FF', padding: '28px 36px' }}>
        <input value={get('title')} onChange={e => set('title', e.target.value)} placeholder="제목 입력" style={{ width: '100%', background: 'transparent', border: 'none', borderBottom: '2px solid rgba(255,255,255,0.3)', outline: 'none', fontSize: 20, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-noto-sans-kr), sans-serif', padding: '2px 0', textAlign: 'center' }} />
        <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.3)', marginTop: 6, textAlign: 'center' }}>✏️ 클릭하여 제목 수정 가능</div>
      </div>

      <div style={{ padding: '32px 36px' }}>

        {/* 로고 업로드 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>로고 이미지</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {get('logo_url') && (
              <img src={get('logo_url') as string} alt="로고" style={{ height: 40, objectFit: 'contain' }} />
            )}
            <label style={{ padding: '8px 16px', background: '#1E90FF', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>
              {uploading ? '업로드 중...' : '이미지 선택'}
              <input type="file" accept="image/*" onChange={uploadLogo} style={{ display: 'none' }} />
            </label>
            {get('logo_url') && (
              <button onClick={() => set('logo_url', '')} style={{ background: 'none', border: 'none', color: '#e74c3c', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>삭제</button>
            )}
          </div>
        </div>

        {/* 상품 선택지 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>상품 선택지</div>
          {(get('product_options') as string[]).map((opt: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={opt}
                onChange={e => updateProductOption(i, e.target.value)}
                placeholder={`상품 ${i + 1}`}
                style={optionInput}
              />
              <button onClick={() => removeProductOption(i)} style={removeBtn}>×</button>
            </div>
          ))}
          <button onClick={addProductOption} style={addBtn}>＋ 상품 추가</button>
        </div>

        {/* 약정기간 선택지 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>약정기간 선택지</div>
          {(get('period_options') as string[]).map((opt: string, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={opt}
                onChange={e => updatePeriodOption(i, e.target.value)}
                placeholder={`기간 ${i + 1} (예: 24개월)`}
                style={optionInput}
              />
              <button onClick={() => removePeriodOption(i)} style={removeBtn}>×</button>
            </div>
          ))}
          <button onClick={addPeriodOption} style={addBtn}>＋ 기간 추가</button>
        </div>

        {/* 안내사항 */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 14 }}>안내사항</div>
        <div style={{ borderBottom: '2px solid #1E90FF', display: 'flex', gap: 10, paddingBottom: 6, marginBottom: 4 }}>
          <span style={{ minWidth: 34 }}></span>
          <span style={{ flex: '0 0 140px', fontSize: 11, fontWeight: 700, color: '#888' }}>항목</span>
          <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#888' }}>내용</span>
          <span style={{ minWidth: 28 }}></span>
        </div>

        {get('items').map((item: NoticeItem, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f0f0', alignItems: 'flex-start' }}>
            <span style={{ minWidth: 24, height: 24, borderRadius: '50%', background: '#1E90FF', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-block', textAlign: 'center', lineHeight: '24px', flexShrink: 0, marginTop: 6 }}>{i + 1}</span>
            <input value={item.label} onChange={e => updateItem(i, 'label', e.target.value)} placeholder="항목명" style={{ flex: '0 0 140px', padding: '6px 8px', fontSize: 13, border: '1.5px solid #ddd', borderRadius: 6, outline: 'none', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }} />
            <textarea value={item.content} onChange={e => updateItem(i, 'content', e.target.value)} placeholder="내용" rows={3} style={{ flex: 1, padding: '6px 8px', fontSize: 13, border: '1.5px solid #ddd', borderRadius: 6, outline: 'none', fontFamily: 'var(--font-noto-sans-kr), sans-serif', resize: 'vertical', lineHeight: 1.6 }} />
            <button onClick={() => removeItem(i)} style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 20, cursor: 'pointer', padding: '2px 4px', marginTop: 4 }}>×</button>
          </div>
        ))}
        <button onClick={addItem} style={{ width: '100%', padding: 10, border: '1.5px dashed #ccc', borderRadius: 8, background: 'none', color: '#888', fontSize: 13, cursor: 'pointer', marginTop: 8, fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>＋ 항목 추가</button>

        <hr style={{ border: 'none', borderTop: '1.5px solid #eee', margin: '28px 0' }} />

        {/* 확인 문구 */}
        <div style={{ ...sectionBox, marginBottom: 28 }}>
          <div style={sectionLabel}>확인 문구</div>
          <input value={get('confirm_text')} onChange={e => set('confirm_text', e.target.value)} placeholder="확인 문구 입력" style={{ width: '100%', fontSize: 14, color: '#333', fontWeight: 500, border: 'none', borderBottom: '1.5px solid #d0d5f0', background: 'transparent', outline: 'none', fontFamily: 'var(--font-noto-sans-kr), sans-serif', padding: '4px 0' }} />
        </div>

        <button onClick={save} disabled={saving} style={{ width: '100%', padding: 14, background: '#1E90FF', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>
          {saving ? '저장 중...' : saved ? '✓ 저장됨!' : '저장'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// 사은품 설정 (기존 기능)
// ============================================================
function GiftSettingsPanel() {
  const [gift, setGift] = useState<GiftSettings>({ ...defaultGift, period_options: [{ code: '', period: '' }], extra_items: [] })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [loaded, setLoaded] = useState(false)

  useEffect(() => { loadGift() }, [])

  async function loadGift() {
    const { data: row } = await supabase.from('gift_settings').select('*').eq('id', 1).maybeSingle()
    if (row) {
      const loadedPeriods: PeriodEntry[] = (row.period_options && row.period_options.length > 0)
        ? row.period_options.map((p: any) => typeof p === 'string' ? { code: '', period: p } : { code: p.code || '', period: p.period || '' })
        : [{ code: '', period: '' }]
      setGift({
        page_title: row.page_title || defaultGift.page_title,
        page_description: row.page_description || defaultGift.page_description,
        banner_text: row.banner_text ?? defaultGift.banner_text,
        template_image_url: row.template_image_url || '',
        brand_name: row.brand_name || '',
        product_name: row.product_name || '',
        amount_text: row.amount_text || '',
        period_options: loadedPeriods,
        usage_method: row.usage_method || '',
        exchange_place: row.exchange_place || '',
        extra_items: row.extra_items || [],
        background_color: row.background_color || '#FFF3D6',
      })
    }
    setLoaded(true)
  }

  function set<K extends keyof GiftSettings>(field: K, value: GiftSettings[K]) {
    setGift(prev => ({ ...prev, [field]: value }))
  }

  function addPeriodOption() { set('period_options', [...gift.period_options, { code: '', period: '' }]) }
  function removePeriodOption(i: number) {
    set('period_options', gift.period_options.filter((_: PeriodEntry, idx: number) => idx !== i))
  }
  function updatePeriodOption(i: number, field: keyof PeriodEntry, value: string) {
    const next = [...gift.period_options]
    next[i] = { ...next[i], [field]: value }
    set('period_options', next)
  }

  function addExtraItem() { set('extra_items', [...gift.extra_items, { label: '', content: '' }]) }
  function removeExtraItem(i: number) {
    set('extra_items', gift.extra_items.filter((_: NoticeItem, idx: number) => idx !== i))
  }
  function updateExtraItem(i: number, field: keyof NoticeItem, value: string) {
    const next = [...gift.extra_items]
    next[i] = { ...next[i], [field]: value }
    set('extra_items', next)
  }

  async function uploadTemplate(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fileName = `gift_template_${Date.now()}.${file.name.split('.').pop()}`
    const { error } = await supabase.storage
      .from('gift-templates')
      .upload(fileName, file, { upsert: true })
    if (error) {
      alert('업로드 실패: ' + error.message + '\n(Supabase Storage에 gift-templates 버킷이 있는지 확인해주세요)')
      setUploading(false)
      return
    }
    const { data: urlData } = supabase.storage.from('gift-templates').getPublicUrl(fileName)
    set('template_image_url', urlData.publicUrl)
    setUploading(false)
  }

  async function save() {
    setSaving(true)
    await supabase.from('gift_settings').upsert({
      id: 1,
      ...gift,
      updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!loaded) return null

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', overflow: 'hidden' }}>

      <div style={{ background: 'linear-gradient(135deg, #ff9800, #f57c00)', padding: '28px 36px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', textAlign: 'center' }}>🎁 사은품(기프티콘) 설정</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 6, textAlign: 'center' }}>
          여기서 등록한 내용은 매니저가 사용하는 '기프티콘 생성 페이지'에서 자동으로 불러와집니다
        </div>
      </div>

      <div style={{ padding: '32px 36px' }}>

        {/* 페이지 타이틀 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>화면 상단 타이틀</div>
          <input
            value={gift.page_title}
            onChange={e => set('page_title', e.target.value)}
            placeholder="예: B상품권 기프티콘 이미지 생성"
            style={fullInput}
          />
        </div>

        {/* 페이지 설명 문구 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>화면 상단 설명 문구</div>
          <textarea
            value={gift.page_description}
            onChange={e => set('page_description', e.target.value)}
            placeholder="예: 정보를 입력한 뒤 이미지에 반영하기로 미리보기를 확인하고, 쿠폰 이미지를 저장하세요"
            rows={2}
            style={{ ...fullInput, resize: 'vertical', lineHeight: 1.6 }}
          />
        </div>

        {/* 상단 배너 기본 문구 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>상단 배너 기본 문구</div>
          <input
            value={gift.banner_text}
            onChange={e => set('banner_text', e.target.value)}
            placeholder="예: 매니저님이 드리는 혜택"
            style={fullInput}
          />
          <div style={{ fontSize: 11, color: '#aaa', marginTop: 6, lineHeight: 1.6 }}>
            여기 입력한 문구는 생성 화면에 처음 보여지는 <b>기본 초안</b>일 뿐이며, 실제로는 매니저가 화면에서 자유롭게 수정해서 사용합니다.<br />
            비워두면 생성 화면에 배너 입력 영역 자체가 표시되지 않습니다.
          </div>
        </div>

        {/* 템플릿 이미지 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>기프티콘 상단 이미지</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            {gift.template_image_url && (
              <img src={gift.template_image_url} alt="템플릿" style={{ height: 90, objectFit: 'contain', borderRadius: 8, border: '1px solid #eee' }} />
            )}
            <label style={{ padding: '8px 16px', background: '#ff9800', color: '#fff', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>
              {uploading ? '업로드 중...' : '이미지 선택'}
              <input type="file" accept="image/*" onChange={uploadTemplate} style={{ display: 'none' }} />
            </label>
            {gift.template_image_url && (
              <button onClick={() => set('template_image_url', '')} style={{ background: 'none', border: 'none', color: '#e74c3c', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>삭제</button>
            )}
          </div>
        </div>

        {/* 기본 정보 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>브랜드명 (예: CU)</div>
          <input value={gift.brand_name} onChange={e => set('brand_name', e.target.value)} placeholder="예: CU" style={fullInput} />
        </div>

        <div style={sectionBox}>
          <div style={sectionLabel}>상품명 (예: CU 모바일 상품권)</div>
          <input value={gift.product_name} onChange={e => set('product_name', e.target.value)} placeholder="예: CU 모바일 상품권" style={fullInput} />
        </div>

        <div style={sectionBox}>
          <div style={sectionLabel}>금액 문구 (예: 10,000원)</div>
          <input value={gift.amount_text} onChange={e => set('amount_text', e.target.value)} placeholder="예: 10,000원" style={fullInput} />
        </div>

        {/* 기프티콘 바탕색 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>기프티콘 바탕색</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <input
              type="color"
              value={gift.background_color}
              onChange={e => set('background_color', e.target.value)}
              style={{ width: 48, height: 40, border: '1.5px solid #ddd', borderRadius: 8, padding: 2, cursor: 'pointer', background: 'none' }}
            />
            <input
              value={gift.background_color}
              onChange={e => set('background_color', e.target.value)}
              placeholder="#FFF3D6"
              style={{ ...fullInput, width: 140, fontFamily: 'monospace' }}
            />
            <span style={{ fontSize: 12, color: '#aaa' }}>생성페이지 미리보기 바탕색에 적용됩니다</span>
          </div>
        </div>

        {/* 등록기간 선택지 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>등록기간 선택지 (항목 + 등록기간 세트로 여러 개 등록 — 생성 페이지에서 선택)</div>
          <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
            <span style={{ flex: '0 0 140px', fontSize: 11, fontWeight: 700, color: '#888' }}>항목</span>
            <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#888' }}>등록기간</span>
            <span style={{ minWidth: 20 }}></span>
          </div>
          {gift.period_options.map((entry: PeriodEntry, i: number) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={entry.code}
                onChange={e => updatePeriodOption(i, 'code', e.target.value)}
                placeholder="예: 2606"
                style={{ ...optionInput, flex: '0 0 140px' }}
              />
              <input
                value={entry.period}
                onChange={e => updatePeriodOption(i, 'period', e.target.value)}
                placeholder="예: 6월~7월"
                style={optionInput}
              />
              <button onClick={() => removePeriodOption(i)} style={removeBtn}>×</button>
            </div>
          ))}
          <button onClick={addPeriodOption} style={addBtn}>＋ 등록기간 추가</button>
        </div>

        <div style={sectionBox}>
          <div style={sectionLabel}>교환처</div>
          <input value={gift.exchange_place} onChange={e => set('exchange_place', e.target.value)} placeholder="예: CU 전국 매장" style={fullInput} />
        </div>

        <div style={sectionBox}>
          <div style={sectionLabel}>사용방법 안내</div>
          <textarea value={gift.usage_method} onChange={e => set('usage_method', e.target.value)} placeholder="예: 매장 방문 후 쿠폰번호를 제시해주세요" rows={4} style={{ ...fullInput, resize: 'vertical', lineHeight: 1.6 }} />
        </div>

        {/* 추가 항목 */}
        <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 14 }}>추가 항목 (필요한 안내 항목을 자유롭게 추가하세요)</div>
        <div style={{ borderBottom: '2px solid #ff9800', display: 'flex', gap: 10, paddingBottom: 6, marginBottom: 4 }}>
          <span style={{ minWidth: 34 }}></span>
          <span style={{ flex: '0 0 140px', fontSize: 11, fontWeight: 700, color: '#888' }}>항목명</span>
          <span style={{ flex: 1, fontSize: 11, fontWeight: 700, color: '#888' }}>내용</span>
          <span style={{ minWidth: 28 }}></span>
        </div>

        {gift.extra_items.map((item: NoticeItem, i: number) => (
          <div key={i} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: '1px solid #f0f0f0', alignItems: 'flex-start' }}>
            <span style={{ minWidth: 24, height: 24, borderRadius: '50%', background: '#ff9800', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-block', textAlign: 'center', lineHeight: '24px', flexShrink: 0, marginTop: 6 }}>{i + 1}</span>
            <input value={item.label} onChange={e => updateExtraItem(i, 'label', e.target.value)} placeholder="예: 환불 규정" style={{ flex: '0 0 140px', padding: '6px 8px', fontSize: 13, border: '1.5px solid #ddd', borderRadius: 6, outline: 'none', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }} />
            <textarea value={item.content} onChange={e => updateExtraItem(i, 'content', e.target.value)} placeholder="내용" rows={2} style={{ flex: 1, padding: '6px 8px', fontSize: 13, border: '1.5px solid #ddd', borderRadius: 6, outline: 'none', fontFamily: 'var(--font-noto-sans-kr), sans-serif', resize: 'vertical', lineHeight: 1.6 }} />
            <button onClick={() => removeExtraItem(i)} style={{ background: 'none', border: 'none', color: '#ccc', fontSize: 20, cursor: 'pointer', padding: '2px 4px', marginTop: 4 }}>×</button>
          </div>
        ))}
        <button onClick={addExtraItem} style={{ width: '100%', padding: 10, border: '1.5px dashed #ccc', borderRadius: 8, background: 'none', color: '#888', fontSize: 13, cursor: 'pointer', marginTop: 8, marginBottom: 28, fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>＋ 항목 추가</button>

        <button onClick={save} disabled={saving} style={{ width: '100%', padding: 14, background: '#ff9800', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>
          {saving ? '저장 중...' : saved ? '✓ 저장됨!' : '저장'}
        </button>
      </div>
    </div>
  )
}

// ============================================================
// 🏃 프로모션 현황 설정 (신규 기능)
// ============================================================
type ManagerRow = { branch: string; team: string; manager_name: string; performance: number }
type PromoSettings = {
  title: string
  target1: number; target2: number; target3: number
  reward1_text: string; reward2_text: string; reward3_text: string
  current_day: number; total_day: number
  cheer_messages: string[]
}

const defaultPromoSettings: PromoSettings = {
  title: '프로모션 달성 현황',
  target1: 5, target2: 10, target3: 15,
  reward1_text: '1만원권', reward2_text: '2만원권', reward3_text: '3만원권',
  current_day: 3, total_day: 5,
  cheer_messages: ['조금만 더 힘내요', '거의 다 왔어요, 파이팅', '오늘도 달리는 중', '한 걸음만 더', '끝까지 힘내주세요'],
}

function parsePastedTable(text: string): ManagerRow[] {
  const lines = text.trim().split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length === 0) return []

  const header = lines[0].split('\t')
  const looksLikeHeader = header.some(h => h.includes('매니저') || h.includes('지사') || h.includes('실적'))
  const idx = {
    branch: header.findIndex(h => h.includes('지사')),
    team: header.findIndex(h => h.includes('팀')),
    name: header.findIndex(h => h.includes('매니저') || h.includes('이름')),
    perf: header.findIndex(h => h.includes('실적')),
  }

  const dataLines = looksLikeHeader ? lines.slice(1) : lines
  const rows: ManagerRow[] = []

  for (const line of dataLines) {
    const cols = line.split('\t').map(c => c.trim())
    if (cols.length < 2) continue

    let branch = '', team = '', name = '', perf = ''
    if (looksLikeHeader && idx.name >= 0) {
      branch = idx.branch >= 0 ? cols[idx.branch] : ''
      team = idx.team >= 0 ? cols[idx.team] : ''
      name = cols[idx.name]
      perf = idx.perf >= 0 ? cols[idx.perf] : ''
    } else {
      // 헤더가 없거나 못 찾으면: NO 지사 팀 매니저 실적 (보상) 순서로 추정
      const c = cols[0]?.match(/^\d+$/) ? cols.slice(1) : cols
      branch = c[0] || ''
      team = c[1] || ''
      name = c[2] || ''
      perf = c[3] || ''
    }

    if (!name) continue
    const performance = Number(String(perf).replace(/[^0-9.-]/g, '')) || 0
    rows.push({ branch, team, manager_name: name, performance })
  }
  return rows
}

function PromotionSettingsPanel() {
  const [settings, setSettings] = useState<PromoSettings>(defaultPromoSettings)
  const [pasteText, setPasteText] = useState('')
  const [preview, setPreview] = useState<ManagerRow[]>([])
  const [currentManagers, setCurrentManagers] = useState<ManagerRow[]>([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => { load() }, [])

  async function load() {
    const { data: s } = await supabase.from('promotion_settings').select('*').eq('id', 1).maybeSingle()
    if (s) {
      setSettings({
        title: s.title || defaultPromoSettings.title,
        target1: s.target1 ?? defaultPromoSettings.target1,
        target2: s.target2 ?? defaultPromoSettings.target2,
        target3: s.target3 ?? defaultPromoSettings.target3,
        reward1_text: s.reward1_text || defaultPromoSettings.reward1_text,
        reward2_text: s.reward2_text || defaultPromoSettings.reward2_text,
        reward3_text: s.reward3_text || defaultPromoSettings.reward3_text,
        current_day: s.current_day ?? defaultPromoSettings.current_day,
        total_day: s.total_day ?? defaultPromoSettings.total_day,
        cheer_messages: (Array.isArray(s.cheer_messages) && s.cheer_messages.length > 0) ? s.cheer_messages : defaultPromoSettings.cheer_messages,
      })
    }
    const { data: rows } = await supabase.from('promotion_managers').select('branch,team,manager_name,performance').order('performance', { ascending: false })
    if (rows) setCurrentManagers(rows as ManagerRow[])
    setLoaded(true)
  }

  function set<K extends keyof PromoSettings>(field: K, value: PromoSettings[K]) {
    setSettings(prev => ({ ...prev, [field]: value }))
  }

  function handlePasteChange(text: string) {
    setPasteText(text)
    setPreview(parsePastedTable(text))
  }

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    const text = await file.text()
    // 콤마 CSV일 수도 있으니 탭이 없으면 콤마를 탭으로 변환
    const normalized = text.includes('\t') ? text : text.replace(/,/g, '\t')
    handlePasteChange(normalized)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  async function saveManagers() {
    if (preview.length === 0) {
      alert('먼저 실적 데이터를 붙여넣거나 CSV 파일을 업로드해주세요.')
      return
    }
    setSaving(true)
    await supabase.from('promotion_managers').delete().neq('id', -1)
    const { error } = await supabase.from('promotion_managers').insert(
      preview.map(r => ({ ...r, updated_at: new Date().toISOString() }))
    )
    if (error) {
      alert('저장 실패: ' + error.message)
      setSaving(false)
      return
    }
    setCurrentManagers([...preview].sort((a, b) => b.performance - a.performance))
    setPasteText('')
    setPreview([])
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  async function saveSettings() {
    setSaving(true)
    await supabase.from('promotion_settings').upsert({
      id: 1, ...settings, updated_at: new Date().toISOString(),
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  if (!loaded) return null

  return (
    <div style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', overflow: 'hidden' }}>

      <div style={{ background: 'linear-gradient(135deg, #2ecc71, #27ae60)', padding: '28px 36px' }}>
        <div style={{ fontSize: 20, fontWeight: 700, color: '#fff', textAlign: 'center' }}>🏃 프로모션 현황판 설정</div>
        <div style={{ fontSize: 12, color: 'rgba(255,255,255,0.85)', marginTop: 6, textAlign: 'center' }}>
          여기서 저장한 실적/목표치가 공개 페이지( /promotion )에 실시간으로 반영됩니다
        </div>
      </div>

      <div style={{ padding: '32px 36px' }}>

        {/* 진행 설정 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>화면 상단 타이틀</div>
          <input value={settings.title} onChange={e => set('title', e.target.value)} style={fullInput} />
        </div>

        <div style={sectionBox}>
          <div style={sectionLabel}>진행 일차 (현재 며칠째 / 총 며칠)</div>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
            <input type="number" value={settings.current_day} onChange={e => set('current_day', Number(e.target.value))} style={{ ...optionInput, maxWidth: 100 }} />
            <span style={{ color: '#888', fontSize: 13 }}>일차 /</span>
            <input type="number" value={settings.total_day} onChange={e => set('total_day', Number(e.target.value))} style={{ ...optionInput, maxWidth: 100 }} />
            <span style={{ color: '#888', fontSize: 13 }}>영업일</span>
          </div>
        </div>

        {/* 상단 응원 문구 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>상단에 번갈아 뜨는 응원 문구 (3~4초마다 자동 전환)</div>
          {settings.cheer_messages.map((msg, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
              <input
                value={msg}
                onChange={e => {
                  const next = [...settings.cheer_messages]
                  next[i] = e.target.value
                  set('cheer_messages', next)
                }}
                placeholder={`응원 문구 ${i + 1}`}
                style={optionInput}
              />
              <button
                onClick={() => set('cheer_messages', settings.cheer_messages.filter((_, idx) => idx !== i))}
                style={removeBtn}
              >×</button>
            </div>
          ))}
          <button
            onClick={() => set('cheer_messages', [...settings.cheer_messages, ''])}
            style={addBtn}
          >＋ 응원 문구 추가</button>
        </div>

        {/* 구간 목표치 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>구간별 목표치 &amp; 혜택</div>
          {[1, 2, 3].map(n => (
            <div key={n} style={{ display: 'flex', gap: 8, marginBottom: 8, alignItems: 'center' }}>
              <span style={{ fontSize: 12, fontWeight: 700, color: '#2ecc71', minWidth: 46 }}>{n}구간</span>
              <input
                type="number"
                value={(settings as any)[`target${n}`]}
                onChange={e => set(`target${n}` as keyof PromoSettings, Number(e.target.value) as any)}
                placeholder="실적 기준"
                style={{ ...optionInput, maxWidth: 100 }}
              />
              <span style={{ fontSize: 12, color: '#888' }}>이상 →</span>
              <input
                value={(settings as any)[`reward${n}_text`]}
                onChange={e => set(`reward${n}_text` as keyof PromoSettings, e.target.value as any)}
                placeholder="혜택 (예: 1만원권)"
                style={optionInput}
              />
            </div>
          ))}
          <button onClick={saveSettings} disabled={saving} style={{ ...addBtn, borderStyle: 'solid', color: '#2ecc71', borderColor: '#2ecc71', marginTop: 8 }}>
            {saving ? '저장 중...' : '설정 저장'}
          </button>
        </div>

        <hr style={{ border: 'none', borderTop: '1.5px solid #eee', margin: '28px 0' }} />

        {/* 실적 업로드 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>매니저 실적 업로드 (지사 / 팀 / 매니저 / 실적)</div>
          <div style={{ fontSize: 12, color: '#888', marginBottom: 12, lineHeight: 1.6 }}>
            엑셀에서 <b>지사, 팀, 매니저, 실적</b> 컬럼(헤더 포함)을 그대로 복사해서 아래에 붙여넣으세요.<br />
            또는 CSV 파일을 업로드해도 됩니다. 저장하면 기존 실적 데이터를 <b>전체 교체</b>합니다.
          </div>

          <textarea
            value={pasteText}
            onChange={e => handlePasteChange(e.target.value)}
            placeholder={'지사\t팀\t매니저\t실적\n동부\t1팀 T\t김지은\t12\n경인\t2팀\t양미숙\t10\n...'}
            rows={6}
            style={{ ...fullInput, resize: 'vertical', fontFamily: 'monospace', fontSize: 12, lineHeight: 1.6, marginBottom: 10 }}
          />

          <label style={{ display: 'inline-block', padding: '8px 16px', background: '#fff', border: '1.5px solid #2ecc71', color: '#2ecc71', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif', marginBottom: 12 }}>
            📁 CSV 파일 선택
            <input ref={fileInputRef} type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
          </label>

          {preview.length > 0 && (
            <div style={{ marginTop: 12 }}>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#2ecc71', marginBottom: 8 }}>미리보기: {preview.length}명 인식됨</div>
              <div style={{ maxHeight: 240, overflowY: 'auto', border: '1.5px solid #eee', borderRadius: 8 }}>
                <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: '#f8f9ff' }}>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>지사</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>팀</th>
                      <th style={{ padding: '6px 10px', textAlign: 'left' }}>매니저</th>
                      <th style={{ padding: '6px 10px', textAlign: 'right' }}>실적</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r, i) => (
                      <tr key={i} style={{ borderTop: '1px solid #f0f0f0' }}>
                        <td style={{ padding: '5px 10px' }}>{r.branch}</td>
                        <td style={{ padding: '5px 10px' }}>{r.team}</td>
                        <td style={{ padding: '5px 10px' }}>{r.manager_name}</td>
                        <td style={{ padding: '5px 10px', textAlign: 'right' }}>{r.performance}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <button onClick={saveManagers} disabled={saving} style={{ width: '100%', padding: 14, marginTop: 14, background: '#2ecc71', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>
                {saving ? '저장 중...' : saved ? '✓ 저장됨!' : `이 ${preview.length}명으로 실적 데이터 전체 교체 저장`}
              </button>
            </div>
          )}
        </div>

        {/* 현재 저장된 데이터 */}
        <div style={sectionBox}>
          <div style={sectionLabel}>현재 저장된 실적 데이터 ({currentManagers.length}명)</div>
          {currentManagers.length === 0 ? (
            <div style={{ fontSize: 13, color: '#aaa' }}>아직 업로드된 데이터가 없습니다.</div>
          ) : (
            <div style={{ maxHeight: 200, overflowY: 'auto', border: '1.5px solid #eee', borderRadius: 8 }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 12 }}>
                <tbody>
                  {currentManagers.map((r, i) => (
                    <tr key={i} style={{ borderTop: i === 0 ? 'none' : '1px solid #f0f0f0' }}>
                      <td style={{ padding: '5px 10px', color: '#888' }}>{r.branch} · {r.team}</td>
                      <td style={{ padding: '5px 10px', fontWeight: 600 }}>{r.manager_name}</td>
                      <td style={{ padding: '5px 10px', textAlign: 'right', fontWeight: 700, color: '#2ecc71' }}>{r.performance}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}