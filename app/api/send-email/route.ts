import { Resend } from 'resend'
import { NextRequest, NextResponse } from 'next/server'

const resend = new Resend(process.env.RESEND_API_KEY)

export async function POST(req: NextRequest) {
  try {
    const { to, studentName, contractDate, pdfBase64 } = await req.json()

    const { data, error } = await resend.emails.send({
      from: 'onboarding@resend.dev',
      to: [to],
      subject: `[안내확인서] ${studentName}님 서명 완료`,
      html: `
        <div style="font-family: sans-serif; max-width: 600px; margin: 0 auto;">
          <h2 style="color: #1E90FF;">안내확인서 전달</h2>
          <p>안녕하세요,</p>
          <p><strong>${studentName}</strong>님의 안내확인서(${contractDate})가 첨부되었습니다.</p>
          <p style="color: #888; font-size: 12px;">본 메일은 발신 전용입니다.</p>
        </div>
      `,
      attachments: [
        {
          filename: `${studentName}_안내확인서_${contractDate}.pdf`,
          content: pdfBase64,
        },
      ],
    })

    if (error) return NextResponse.json({ error }, { status: 400 })
    return NextResponse.json({ success: true, data })
  } catch (e) {
    return NextResponse.json({ error: '서버 오류' }, { status: 500 })
  }
}
