'use client'

import { useEffect, useState } from 'react'
import { supabase } from '@/lib/supabase'

interface NoticeItem { label: string; content: string }
type CategoryData = { title: string; items: NoticeItem[]; confirm_text: string; logo_url: string }

const CATEGORIES = [
  { key: 'infant', label: '유아' },
  { key: 'junior', label: '초중' },
]

const defaultData: CategoryData = {
  title: '필수 안내사항 확인',
  items: [{ label: '', content: '' }],
  confirm_text: '위 안내사항을 모두 확인하였으며, 내용을 충분히 안내받았음을 확인합니다.',
  logo_url: ''
}

export default function AdminPage() {
  const [tab, setTab] = useState('infant')
  const [data, setData] = useState<Record<string, CategoryData>>({
    infant: { ...defaultData, items: [...defaultData.items] },
    junior: { ...defaultData, items: [...defaultData.items] }
  })
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [uploading, setUploading] = useState(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: rows } = await supabase.from('consent_notices').select('*')
    if (!rows) return
    const next: Record<string, CategoryData> = {
      infant: { ...defaultData, items: [...defaultData.items] },
      junior: { ...defaultData, items: [...defaultData.items] }
    }
    rows.forEach(row => {
      if (row.category === 'infant' || row.category === 'junior') {
        next[row.category] = {
          title: row.title,
          items: row.items,
          confirm_text: row.confirm_text || defaultData.confirm_text,
          logo_url: row.logo_url || ''
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

  async function uploadLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    const fileName = `${tab}_logo_${Date.now()}.${file.name.split('.').pop()}`
    const { data: uploadData, error } = await supabase.storage
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
      updated_at: new Date().toISOString()
    })
    setSaving(false)
    setSaved(true)
    setTimeout(() => setSaved(false), 2000)
  }

  return (
    <div style={{ maxWidth: '100%', margin: '0', padding: '30px 40px', fontFamily: 'var(--font-noto-sans-kr), sans-serif', background: '#EBF5FF', minHeight: '100vh' }}>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
        <h1 style={{ fontSize: 18, fontWeight: 700, color: '#1a1a2e' }}>안내사항 설정</h1>
        <a href="/consent" target="_blank" style={{ padding: '8px 18px', background: '#fff', border: '1.5px solid #1E90FF', borderRadius: 8, fontSize: 13, fontWeight: 700, color: '#1E90FF', textDecoration: 'none' }}>👁 고객 화면 미리보기</a>
      </div>

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
          <div style={{ marginBottom: 28, padding: 20, background: '#f8f9ff', border: '1.5px solid #d0d5f0', borderRadius: 10 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 12 }}>로고 이미지</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
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
          <div style={{ background: '#f8f9ff', border: '1.5px solid #d0d5f0', borderRadius: 10, padding: '16px 20px', marginBottom: 28 }}>
            <div style={{ fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 8 }}>확인 문구</div>
            <input value={get('confirm_text')} onChange={e => set('confirm_text', e.target.value)} placeholder="확인 문구 입력" style={{ width: '100%', fontSize: 14, color: '#333', fontWeight: 500, border: 'none', borderBottom: '1.5px solid #d0d5f0', background: 'transparent', outline: 'none', fontFamily: 'var(--font-noto-sans-kr), sans-serif', padding: '4px 0' }} />
          </div>

          <button onClick={save} disabled={saving} style={{ width: '100%', padding: 14, background: '#1E90FF', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>
            {saving ? '저장 중...' : saved ? '✓ 저장됨!' : '저장'}
          </button>
        </div>
      </div>
    </div>
  )
}