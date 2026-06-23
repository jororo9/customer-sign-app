// app/api/upload/route.ts
import { put } from '@vercel/blob'
import { NextRequest, NextResponse } from 'next/server'

export async function POST(req: NextRequest) {
  const formData = await req.formData()
  const file = formData.get('file') as File

  if (!file) {
    return NextResponse.json({ error: '파일이 없습니다.' }, { status: 400 })
  }

  // Vercel Blob에 업로드 (24시간 후 자동 만료 옵션 없음 → 추후 cron으로 삭제)
  const blob = await put(file.name, file, {
    access: 'public',      // 누구나 URL로 접근 가능 (고객 QR 스캔용)
    addRandomSuffix: true, // 파일명 중복 방지용 랜덤 suffix 자동 추가
  })

  return NextResponse.json({ url: blob.url })
}