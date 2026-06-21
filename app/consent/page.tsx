'use client'

import { useEffect, useRef, useState } from 'react'
import { supabase } from '@/lib/supabase'
import html2canvas from 'html2canvas'
import jsPDF from 'jspdf'

interface NoticeItem { label: string; content: string }
type CategoryData = { title: string; items: NoticeItem[]; confirm_text: string; logo_url: string }

const CATEGORIES = [
  { key: 'infant', label: '유아' },
  { key: 'junior', label: '초중' },
]

const defaultData: CategoryData = {
  title: '필수 안내사항 확인',
  items: [],
  confirm_text: '위 안내사항을 모두 확인하였으며, 내용을 충분히 안내받았음을 확인합니다.',
  logo_url: ''
}

export default function ConsentPage() {
  const [tab, setTab] = useState('infant')
  const [data, setData] = useState<Record<string, CategoryData>>({
    infant: { ...defaultData, items: [], logo_url: '' },
    junior: { ...defaultData, items: [], logo_url: '' }
  })
  const [studentName, setStudentName] = useState('')
  const [studentId, setStudentId] = useState('')
  const [product, setProduct] = useState('')
  const [contractPeriod, setContractPeriod] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [contractDate, setContractDate] = useState(new Date().toISOString().split('T')[0])
  const [checked, setChecked] = useState(false)
  const [capturing, setCapturing] = useState(false)
  const [penMode, setPenMode] = useState<'highlighter' | 'sign'>('sign')
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const highlightRef = useRef<HTMLCanvasElement>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const drawing = useRef(false)

  useEffect(() => { loadAll() }, [])

  async function loadAll() {
    const { data: rows } = await supabase.from('consent_notices').select('*')
    if (!rows) return
    const next: Record<string, CategoryData> = {
      infant: { ...defaultData, items: [], logo_url: '' },
      junior: { ...defaultData, items: [], logo_url: '' }
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

  function getPos(e: any, canvas: HTMLCanvasElement) {
    const r = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    return { x: src.clientX - r.left, y: src.clientY - r.top }
  }

  function startDraw(e: any) {
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    drawing.current = true
    const p = getPos(e, canvas)
    ctx.beginPath(); ctx.moveTo(p.x, p.y)
  }

  function draw(e: any) {
    if (!drawing.current || penMode !== 'sign') return
    const canvas = canvasRef.current!
    const ctx = canvas.getContext('2d')!
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 2; ctx.lineCap = 'round'
    const p = getPos(e, canvas)
    ctx.lineTo(p.x, p.y); ctx.stroke()
  }

  function stopDraw() { drawing.current = false }

  function clearCanvas() {
    canvasRef.current?.getContext('2d')?.clearRect(0, 0, 400, 80)
  }

  function startHighlight(e: any) {
    if (penMode !== 'highlighter') return
    const canvas = highlightRef.current!
    const ctx = canvas.getContext('2d')!
    drawing.current = true
    const r = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    ctx.beginPath()
    ctx.moveTo(src.clientX - r.left, src.clientY - r.top)
  }

  function doHighlight(e: any) {
    if (!drawing.current || penMode !== 'highlighter') return
    const canvas = highlightRef.current!
    const ctx = canvas.getContext('2d')!
    const r = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    ctx.globalAlpha = 0.08
    ctx.strokeStyle = '#FFE500'
    ctx.lineWidth = 20
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineTo(src.clientX - r.left, src.clientY - r.top)
    ctx.stroke()
  }

  function stopHighlight() { drawing.current = false }

  function clearHighlight() {
    const canvas = highlightRef.current
    if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }

  useEffect(() => {
    const updateSize = () => {
      if (noticeRef.current && highlightRef.current) {
        const rect = noticeRef.current.getBoundingClientRect()
        highlightRef.current.width = rect.width
        highlightRef.current.height = rect.height
      }
    }
    updateSize()
    window.addEventListener('resize', updateSize)
    return () => window.removeEventListener('resize', updateSize)
  }, [data, tab])

  async function capture() {
    if (!formRef.current) return null
    setCapturing(true)
    await document.fonts.ready
    await new Promise(r => setTimeout(r, 300))
    const canvas = await html2canvas(formRef.current, {
      scale: 2, backgroundColor: '#fff', useCORS: true, logging: false, allowTaint: true,
    })
    setCapturing(false)
    return canvas
  }

  async function saveImage() {
    const canvas = await capture()
    if (!canvas) return
    const link = document.createElement('a')
    link.download = `${studentName || '고객'}_안내확인서_${contractDate}.png`
    link.href = canvas.toDataURL('image/png')
    link.click()
  }

  async function savePDF() {
    const canvas = await capture()
    if (!canvas) return
    const imgData = canvas.toDataURL('image/png')
    const pdf = new jsPDF({ orientation: 'p', unit: 'mm', format: 'a4' })
    const pageW = 210, pageH = 297
    const imgW = pageW
    const imgH = canvas.height * imgW / canvas.width
    let heightLeft = imgH, position = 0
    pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH)
    heightLeft -= pageH
    while (heightLeft > 0) {
      position -= pageH; pdf.addPage()
      pdf.addImage(imgData, 'PNG', 0, position, imgW, imgH)
      heightLeft -= pageH
    }
    pdf.save(`${studentName || '고객'}_안내확인서_${contractDate}.pdf`)
  }

  const current = data[tab]
  const fieldStyle: React.CSSProperties = {
    border: 'none', borderBottom: '2px solid #ddd', padding: '8px 2px',
    fontSize: 15, outline: 'none', width: '100%',
    fontFamily: 'var(--font-noto-sans-kr), sans-serif', background: 'transparent'
  }
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px', fontFamily: 'var(--font-noto-sans-kr), sans-serif', background: '#EBF5FF', minHeight: '100vh' }}>

      {/* 펜 토글 버튼 */}
      {!capturing && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8 }}>
          <button onClick={() => setPenMode('highlighter')} style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif', background: penMode === 'highlighter' ? '#FFE500' : '#fff', borderColor: penMode === 'highlighter' ? '#FFD000' : '#ddd', color: '#333' }}>
            🖊 형광펜
          </button>
          <button onClick={() => setPenMode('sign')} style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid', fontSize: 13, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif', background: penMode === 'sign' ? '#1E90FF' : '#fff', borderColor: penMode === 'sign' ? '#1E90FF' : '#ddd', color: penMode === 'sign' ? '#fff' : '#333' }}>
            ✒️ 서명펜
          </button>
          {penMode === 'highlighter' && (
            <button onClick={clearHighlight} style={{ padding: '8px 16px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 13, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif', background: '#fff', color: '#888' }}>
              형광펜 지우기
            </button>
          )}
        </div>
      )}

      <div ref={formRef} style={{ background: '#fff', borderRadius: 12, boxShadow: '0 4px 24px rgba(0,0,0,0.10)', overflow: 'hidden' }}>

        {/* 탭 */}
        {!capturing && (
          <div style={{ display: 'flex', borderBottom: '2px solid #f0f0f0' }}>
            {CATEGORIES.map(c => (
              <button key={c.key} onClick={() => { setTab(c.key); setChecked(false); clearCanvas(); clearHighlight() }}
                style={{ flex: 1, padding: 16, border: 'none', background: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', color: tab === c.key ? '#1E90FF' : '#aaa', borderBottom: tab === c.key ? '3px solid #1E90FF' : '3px solid transparent', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* 로고 */}
        {current.logo_url && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 36px 0', background: '#fff' }}>
            <img src={current.logo_url} alt="로고" style={{ height: 50, objectFit: 'contain' }} crossOrigin="anonymous" />
          </div>
        )}

        {/* 헤더 */}
        <div style={{ background: '#1E90FF', padding: '20px 24px', marginTop: current.logo_url ? 16 : 0 }}>
          <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', textAlign: 'center', wordBreak: 'keep-all' }}>{current.title}</div>
        </div>

        <div style={{ padding: '20px 16px' }}>

          {/* 상단 정보 1행 */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 12 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>학생명</label>
              {capturing
                ? <div style={{ ...fieldStyle, paddingTop: 8, paddingBottom: 8 }}>{studentName}</div>
                : <input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="이름 입력" style={fieldStyle} />}
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>학생 아이디</label>
              {capturing
                ? <div style={{ ...fieldStyle, paddingTop: 8, paddingBottom: 8 }}>{studentId}</div>
                : <input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="아이디 입력" style={fieldStyle} />}
            </div>
          </div>

          {/* 상단 정보 2행 */}
          <div style={{ display: 'flex', gap: 16, marginBottom: 24 }}>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>상품</label>
              {capturing
                ? <div style={{ ...fieldStyle, paddingTop: 8, paddingBottom: 8 }}>{product}</div>
                : <input value={product} onChange={e => setProduct(e.target.value)} placeholder="상품명 입력" style={fieldStyle} />}
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>약정 기간</label>
              {capturing
                ? <div style={{ ...fieldStyle, paddingTop: 8, paddingBottom: 8 }}>{contractPeriod}</div>
                : <input value={contractPeriod} onChange={e => setContractPeriod(e.target.value)} placeholder="예) 12개월" style={fieldStyle} />}
            </div>
          </div>

          {/* 안내사항 */}
          <div ref={noticeRef} style={{ position: 'relative' }}>
            {!capturing && (
              <canvas ref={highlightRef}
                style={{ position: 'absolute', top: 0, left: 0, width: '100%', height: '100%', zIndex: 10, cursor: penMode === 'highlighter' ? 'crosshair' : 'default', pointerEvents: penMode === 'highlighter' ? 'auto' : 'none' }}
                onMouseDown={startHighlight} onMouseMove={doHighlight} onMouseUp={stopHighlight} onMouseLeave={stopHighlight}
                onTouchStart={startHighlight} onTouchMove={doHighlight} onTouchEnd={stopHighlight}
              />
            )}
            <div style={{ borderBottom: '2px solid #1E90FF', marginBottom: 4 }}></div>
            {current.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 8, padding: '10px 0', borderBottom: '1px solid #f0f0f0', alignItems: 'flex-start' }}>
                <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: '#1E90FF', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-block', textAlign: 'center', lineHeight: '22px', flexShrink: 0, marginTop: 2 }}>{i + 1}</span>
                <span style={{ flex: '0 0 80px', fontSize: 13, fontWeight: 700, color: '#1E90FF', wordBreak: 'keep-all' }}>{item.label}</span>
                <span style={{ flex: 1, fontSize: 13, color: '#444', lineHeight: 1.6, whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }}>{item.content}</span>
              </div>
            ))}
          </div>

          <hr style={{ border: 'none', borderTop: '1.5px solid #eee', margin: '20px 0' }} />

          {/* 확인 체크박스 */}
          <div style={{ background: '#EBF5FF', border: '1.5px solid #90CAF9', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0 }} />
              <span style={{ fontSize: 13, color: '#333', fontWeight: 500, wordBreak: 'keep-all' }}>{current.confirm_text}</span>
            </label>
          </div>

          {/* 서명 */}
          <div style={{ display: 'flex', gap: 16, alignItems: 'flex-end', marginBottom: 20 }}>
            <div style={{ flex: '0 0 140px' }}>
              <div style={{ marginBottom: 12 }}>
                <label style={labelStyle}>계약일자</label>
                {capturing
                  ? <div style={{ ...fieldStyle, paddingTop: 8, paddingBottom: 8 }}>{contractDate}</div>
                  : <input type="date" value={contractDate} onChange={e => setContractDate(e.target.value)} style={{ ...fieldStyle, fontSize: 13 }} />}
              </div>
              <div>
                <label style={labelStyle}>고객 성명</label>
                {capturing
                  ? <div style={{ ...fieldStyle, paddingTop: 8, paddingBottom: 8 }}>{customerName}</div>
                  : <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="성명" style={fieldStyle} />}
              </div>
            </div>
            <div style={{ flex: 1 }}>
              <label style={labelStyle}>서명</label>
              <div style={{ border: '2px solid #ddd', borderRadius: 8, overflow: 'hidden', position: 'relative', background: '#fafafa', height: 100 }}>
                <canvas ref={canvasRef} width={400} height={100}
                  onMouseDown={(e) => { setPenMode('sign'); startDraw(e) }}
                  onMouseMove={draw} onMouseUp={stopDraw} onMouseLeave={stopDraw}
                  onTouchStart={(e) => { setPenMode('sign'); startDraw(e) }}
                  onTouchMove={draw} onTouchEnd={stopDraw}
                  style={{ display: 'block', cursor: 'crosshair', width: '100%', height: '100%' }} />
                {!capturing && (
                  <button onClick={clearCanvas} style={{ position: 'absolute', top: 6, right: 8, background: 'none', border: 'none', fontSize: 11, color: '#aaa', cursor: 'pointer' }}>지우기</button>
                )}
              </div>
            </div>
          </div>

          {/* 저장 버튼 */}
          {!capturing && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={savePDF} style={{ flex: 1, padding: 14, background: '#1E90FF', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>
                📄 PDF 저장
              </button>
              <button onClick={saveImage} style={{ flex: 1, padding: 14, background: '#EBF5FF', color: '#1E90FF', border: '1.5px solid #1E90FF', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>
                🖼 이미지 저장
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}