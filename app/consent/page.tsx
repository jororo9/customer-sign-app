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
  const [signModal, setSignModal] = useState(false)
  const [signImage, setSignImage] = useState<string | null>(null)
  const highlightRef = useRef<HTMLCanvasElement>(null)
  const noticeRef = useRef<HTMLDivElement>(null)
  const formRef = useRef<HTMLDivElement>(null)
  const modalCanvasRef = useRef<HTMLCanvasElement>(null)
  const modalDrawing = useRef(false)

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

  function startModalDraw(e: any) {
    const canvas = modalCanvasRef.current!
    const ctx = canvas.getContext('2d')!
    modalDrawing.current = true
    const r = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    const scaleX = canvas.width / r.width
    const scaleY = canvas.height / r.height
    ctx.beginPath()
    ctx.moveTo((src.clientX - r.left) * scaleX, (src.clientY - r.top) * scaleY)
  }

  function doModalDraw(e: any) {
    e.preventDefault()
    if (!modalDrawing.current) return
    const canvas = modalCanvasRef.current!
    const ctx = canvas.getContext('2d')!
    const r = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    const scaleX = canvas.width / r.width
    const scaleY = canvas.height / r.height
    ctx.strokeStyle = '#000000'; ctx.lineWidth = 3; ctx.lineCap = 'round'; ctx.lineJoin = 'round'
    ctx.lineTo((src.clientX - r.left) * scaleX, (src.clientY - r.top) * scaleY)
    ctx.stroke()
  }

  function stopModalDraw() { modalDrawing.current = false }

  function clearModalCanvas() {
    const canvas = modalCanvasRef.current!
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }

  function confirmSign() {
    const canvas = modalCanvasRef.current!
    setSignImage(canvas.toDataURL('image/png'))
    setSignModal(false)
  }

  function startHighlight(e: any) {
    if (penMode !== 'highlighter') return
    const canvas = highlightRef.current!
    const ctx = canvas.getContext('2d')!
    const r = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    modalDrawing.current = true
    ctx.beginPath()
    ctx.moveTo(src.clientX - r.left, src.clientY - r.top)
  }

  function doHighlight(e: any) {
    if (!modalDrawing.current || penMode !== 'highlighter') return
    const canvas = highlightRef.current!
    const ctx = canvas.getContext('2d')!
    const r = canvas.getBoundingClientRect()
    const src = e.touches ? e.touches[0] : e
    ctx.globalAlpha = 0.01
    ctx.strokeStyle = '#FFE500'
    ctx.lineWidth = 20
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.lineTo(src.clientX - r.left, src.clientY - r.top)
    ctx.stroke()
  }

  function stopHighlight() { modalDrawing.current = false }

  function clearHighlight() {
    const canvas = highlightRef.current
    if (!canvas) return
    canvas.getContext('2d')?.clearRect(0, 0, canvas.width, canvas.height)
  }

  useEffect(() => {
    if (signModal) {
      document.body.style.overflow = 'hidden'
      document.body.style.touchAction = 'none'
    } else {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
    return () => {
      document.body.style.overflow = ''
      document.body.style.touchAction = ''
    }
  }, [signModal])

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
  const labelStyle: React.CSSProperties = {
    display: 'block', fontSize: 11, fontWeight: 700, color: '#888', marginBottom: 6
  }
  const inputStyle: React.CSSProperties = {
    border: 'none', background: 'transparent', outline: 'none', width: '100%',
    fontSize: 14, fontFamily: 'var(--font-noto-sans-kr), sans-serif', color: '#1a1a2e', padding: '2px 0'
  }

  return (
    <div style={{ maxWidth: 720, margin: '0 auto', padding: '16px', fontFamily: 'var(--font-noto-sans-kr), sans-serif', background: '#EBF5FF', minHeight: '100vh' }}>

      {/* 서명 모달 */}
      {signModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', background: 'rgba(0,0,0,0.75)', zIndex: 1000, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20 }}>
          <div style={{ background: '#fff', borderRadius: 20, padding: 24, width: '100%', maxWidth: 500, boxShadow: '0 20px 60px rgba(0,0,0,0.3)' }}>
            <div style={{ fontSize: 17, fontWeight: 700, color: '#1a1a2e', marginBottom: 6, textAlign: 'center' }}>서명해 주세요</div>
            <div style={{ fontSize: 12, color: '#aaa', textAlign: 'center', marginBottom: 16 }}>아래 영역에 서명을 입력해 주세요</div>
            <div style={{ border: '2px solid #1E90FF', borderRadius: 12, overflow: 'hidden', background: '#fafafa', marginBottom: 16 }}>
              <canvas ref={modalCanvasRef} width={460} height={220}
                onMouseDown={startModalDraw} onMouseMove={doModalDraw} onMouseUp={stopModalDraw} onMouseLeave={stopModalDraw}
                onTouchStart={startModalDraw} onTouchMove={doModalDraw} onTouchEnd={stopModalDraw}
                style={{ display: 'block', cursor: 'crosshair', width: '100%', touchAction: 'none' }} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={clearModalCanvas} style={{ flex: 1, padding: 13, background: '#f5f5f5', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#888', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>지우기</button>
              <button onClick={() => setSignModal(false)} style={{ flex: 1, padding: 13, background: '#f5f5f5', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#888', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>취소</button>
              <button onClick={confirmSign} style={{ flex: 2, padding: 13, background: 'linear-gradient(135deg, #1E90FF, #0066cc)', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', color: '#fff', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>✓ 서명 완료</button>
            </div>
          </div>
        </div>
      )}

      {/* 펜 토글 버튼 */}
      {!capturing && (
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12, gap: 8 }}>
          <button onClick={() => setPenMode('highlighter')} style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif', background: penMode === 'highlighter' ? '#FFE500' : '#fff', borderColor: penMode === 'highlighter' ? '#FFD000' : '#ddd', color: '#333' }}>
            🖊 형광펜
          </button>
          <button onClick={() => setPenMode('sign')} style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid', fontSize: 12, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif', background: penMode === 'sign' ? '#1E90FF' : '#fff', borderColor: penMode === 'sign' ? '#1E90FF' : '#ddd', color: penMode === 'sign' ? '#fff' : '#333' }}>
            ✒️ 서명펜
          </button>
          {penMode === 'highlighter' && (
            <button onClick={clearHighlight} style={{ padding: '7px 14px', borderRadius: 8, border: '1.5px solid #ddd', fontSize: 12, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif', background: '#fff', color: '#888' }}>지우기</button>
          )}
        </div>
      )}

      <div ref={formRef} style={{ background: '#fff', borderRadius: 16, boxShadow: '0 8px 32px rgba(30,144,255,0.10)', overflow: 'hidden' }}>

        {/* 탭 */}
        {!capturing && (
          <div style={{ display: 'flex', borderBottom: '2px solid #f0f0f0' }}>
            {CATEGORIES.map(c => (
              <button key={c.key} onClick={() => { setTab(c.key); setChecked(false); setSignImage(null); clearHighlight() }}
                style={{ flex: 1, padding: 16, border: 'none', background: 'none', fontSize: 15, fontWeight: 700, cursor: 'pointer', color: tab === c.key ? '#1E90FF' : '#aaa', borderBottom: tab === c.key ? '3px solid #1E90FF' : '3px solid transparent', fontFamily: 'var(--font-noto-sans-kr), sans-serif', transition: 'all 0.2s' }}>
                {c.label}
              </button>
            ))}
          </div>
        )}

        {/* 로고 */}
        {current.logo_url && (
          <div style={{ display: 'flex', justifyContent: 'center', padding: '20px 16px 0', background: '#fff' }}>
            <img src={current.logo_url} alt="로고" style={{ height: 50, objectFit: 'contain' }} crossOrigin="anonymous" />
          </div>
        )}

        {/* 헤더 - 격식 강화 */}
        <div style={{ background: 'linear-gradient(135deg, #1E90FF 0%, #0066cc 100%)', padding: '24px 24px', marginTop: current.logo_url ? 12 : 0, boxShadow: '0 4px 16px rgba(30,144,255,0.3)' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10 }}>
            <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="rgba(255,255,255,0.9)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/>
              <polyline points="14 2 14 8 20 8"/>
              <line x1="16" y1="13" x2="8" y2="13"/>
              <line x1="16" y1="17" x2="8" y2="17"/>
              <polyline points="10 9 9 9 8 9"/>
            </svg>
            <div style={{ fontSize: 22, fontWeight: 700, color: '#fff', textAlign: 'center', wordBreak: 'keep-all', letterSpacing: '-0.3px' }}>{current.title}</div>
          </div>
        </div>

        <div style={{ padding: '20px 16px' }}>

          {/* 고객 정보 카드 테이블 */}
          <div style={{ border: '1.5px solid #e8ecf0', borderRadius: 10, overflow: 'hidden', marginBottom: 24 }}>
            {/* 1행 */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e8ecf0' }}>
              <div style={{ flex: '0 0 90px', background: '#f5f7fa', padding: '12px 14px', borderRight: '1px solid #e8ecf0', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>학생명</span>
              </div>
              <div style={{ flex: 1, padding: '10px 14px' }}>
                {capturing
                  ? <div style={{ fontSize: 14, color: '#1a1a2e', fontWeight: 500 }}>{studentName}</div>
                  : <input value={studentName} onChange={e => setStudentName(e.target.value)} placeholder="이름 입력" style={inputStyle} />}
              </div>
              <div style={{ flex: '0 0 90px', background: '#f5f7fa', padding: '12px 14px', borderLeft: '1px solid #e8ecf0', borderRight: '1px solid #e8ecf0', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>아이디</span>
              </div>
              <div style={{ flex: 1, padding: '10px 14px' }}>
                {capturing
                  ? <div style={{ fontSize: 14, color: '#1a1a2e' }}>{studentId}</div>
                  : <input value={studentId} onChange={e => setStudentId(e.target.value)} placeholder="아이디 입력" style={inputStyle} />}
              </div>
            </div>
            {/* 2행 */}
            <div style={{ display: 'flex' }}>
              <div style={{ flex: '0 0 90px', background: '#f5f7fa', padding: '12px 14px', borderRight: '1px solid #e8ecf0', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>상품</span>
              </div>
              <div style={{ flex: 1, padding: '10px 14px' }}>
                {capturing
                  ? <div style={{ fontSize: 14, color: '#1a1a2e', fontWeight: 600 }}>{product}</div>
                  : <input value={product} onChange={e => setProduct(e.target.value)} placeholder="상품명 입력" style={{ ...inputStyle, fontWeight: 600 }} />}
              </div>
              <div style={{ flex: '0 0 90px', background: '#f5f7fa', padding: '12px 14px', borderLeft: '1px solid #e8ecf0', borderRight: '1px solid #e8ecf0', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>약정기간</span>
              </div>
              <div style={{ flex: 1, padding: '10px 14px' }}>
                {capturing
                  ? <div style={{ fontSize: 15, color: '#1E90FF', fontWeight: 700 }}>{contractPeriod}</div>
                  : <input value={contractPeriod} onChange={e => setContractPeriod(e.target.value)} placeholder="예) 24개월" style={{ ...inputStyle, fontSize: 15, color: '#1E90FF', fontWeight: 700 }} />}
              </div>
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
            <div style={{ borderBottom: '2.5px solid #1E90FF', marginBottom: 4 }}></div>
            {current.items.map((item, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, padding: '11px 4px', borderBottom: '1px solid #f0f0f0', alignItems: 'flex-start' }}>
                <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: '#1E90FF', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-block', textAlign: 'center', lineHeight: '22px', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                <span style={{ flex: '0 0 80px', fontSize: 13, fontWeight: 700, color: '#1E90FF', wordBreak: 'keep-all' }}>{item.label}</span>
                <span style={{ flex: 1, fontSize: 13, color: '#444', lineHeight: 1.65, whiteSpace: 'pre-wrap', wordBreak: 'keep-all' }}>{item.content}</span>
              </div>
            ))}
          </div>

          <hr style={{ border: 'none', borderTop: '1.5px solid #eee', margin: '20px 0' }} />

          {/* 확인 체크박스 */}
          <div style={{ background: 'linear-gradient(135deg, #f0f8ff, #e8f4ff)', border: '1.5px solid #b3d9ff', borderRadius: 10, padding: '14px 16px', marginBottom: 20 }}>
            <label style={{ display: 'flex', alignItems: 'flex-start', gap: 12, cursor: 'pointer' }}>
              <input type="checkbox" checked={checked} onChange={e => setChecked(e.target.checked)} style={{ marginTop: 2, width: 18, height: 18, flexShrink: 0, accentColor: '#1E90FF' }} />
              <span style={{ fontSize: 13, color: '#1a1a2e', fontWeight: 500, wordBreak: 'keep-all', lineHeight: 1.6 }}>{current.confirm_text}</span>
            </label>
          </div>

          {/* 서명 영역 */}
          <div style={{ border: '1.5px solid #e8ecf0', borderRadius: 10, overflow: 'hidden', marginBottom: 20 }}>
            {/* 계약일자 + 고객성명 */}
            <div style={{ display: 'flex', borderBottom: '1px solid #e8ecf0' }}>
              <div style={{ flex: '0 0 90px', background: '#f5f7fa', padding: '12px 14px', borderRight: '1px solid #e8ecf0', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>계약일자</span>
              </div>
              <div style={{ flex: 1, padding: '10px 14px' }}>
                {capturing
                  ? <div style={{ fontSize: 13, color: '#1a1a2e' }}>{contractDate}</div>
                  : <input type="date" value={contractDate} onChange={e => setContractDate(e.target.value)} style={{ ...inputStyle, fontSize: 13 }} />}
              </div>
              <div style={{ flex: '0 0 90px', background: '#f5f7fa', padding: '12px 14px', borderLeft: '1px solid #e8ecf0', borderRight: '1px solid #e8ecf0', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>고객 성명</span>
              </div>
              <div style={{ flex: 1, padding: '10px 14px' }}>
                {capturing
                  ? <div style={{ fontSize: 14, color: '#1a1a2e', fontWeight: 600 }}>{customerName}</div>
                  : <input value={customerName} onChange={e => setCustomerName(e.target.value)} placeholder="성명" style={{ ...inputStyle, fontWeight: 600 }} />}
              </div>
            </div>
            {/* 서명칸 */}
            <div style={{ display: 'flex', alignItems: 'stretch' }}>
              <div style={{ flex: '0 0 90px', background: '#f5f7fa', padding: '12px 14px', borderRight: '1px solid #e8ecf0', display: 'flex', alignItems: 'center' }}>
                <span style={{ fontSize: 12, fontWeight: 700, color: '#555' }}>서명</span>
              </div>
              <div style={{ flex: 1, padding: '10px 14px' }}>
                {signImage ? (
                  <div style={{ position: 'relative', border: '1.5px solid #1E90FF', borderRadius: 8, overflow: 'hidden', background: '#fafafa', minHeight: 90 }}>
                    <img src={signImage} alt="서명" style={{ width: '100%', objectFit: 'contain', display: 'block' }} />
                    {!capturing && (
                      <button onClick={() => { setSignImage(null); setSignModal(true) }} style={{ position: 'absolute', top: 6, right: 8, background: 'rgba(255,255,255,0.9)', border: '1px solid #ddd', borderRadius: 6, fontSize: 11, color: '#888', cursor: 'pointer', padding: '2px 8px' }}>다시 서명</button>
                    )}
                  </div>
                ) : (
                  <div onClick={() => setSignModal(true)} style={{ border: '2px dashed #1E90FF', borderRadius: 8, background: '#f0f8ff', minHeight: 90, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', gap: 6 }}>
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#1E90FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M12 20h9"/><path d="M16.5 3.5a2.121 2.121 0 0 1 3 3L7 19l-4 1 1-4L16.5 3.5z"/>
                    </svg>
                    <span style={{ fontSize: 13, color: '#1E90FF', fontWeight: 700 }}>탭하여 서명</span>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 저장 버튼 */}
          {!capturing && (
            <div style={{ display: 'flex', gap: 12 }}>
              <button onClick={savePDF} style={{ flex: 1, padding: 14, background: 'linear-gradient(135deg, #1E90FF, #0066cc)', color: '#fff', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif', boxShadow: '0 4px 12px rgba(30,144,255,0.3)' }}>
                📄 PDF 저장
              </button>
              <button onClick={saveImage} style={{ flex: 1, padding: 14, background: '#fff', color: '#1E90FF', border: '1.5px solid #1E90FF', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-noto-sans-kr), sans-serif' }}>
                🖼 이미지 저장
              </button>
            </div>
          )}

        </div>
      </div>
    </div>
  )
}