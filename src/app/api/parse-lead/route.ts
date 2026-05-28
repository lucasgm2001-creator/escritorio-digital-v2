import { generateText } from 'ai'
import { anthropic } from '@ai-sdk/anthropic'
import { NextResponse } from 'next/server'

export async function POST(req: Request) {
  const { text } = await req.json()

  try {
    const { text: result } = await generateText({
      model: anthropic('claude-haiku-4-5-20251001'),
      prompt: `Extraia os dados do lead abaixo e retorne APENAS um JSON válido com as chaves: name, company, email, phone, notes. Se não encontrar, use string vazia.

Texto: ${text}

Responda apenas com o JSON, sem explicações.`,
      maxOutputTokens: 300,
    })

    const jsonMatch = result.match(/\{[\s\S]*\}/)
    if (!jsonMatch) return NextResponse.json({ lead: null })

    const lead = JSON.parse(jsonMatch[0])
    return NextResponse.json({ lead })
  } catch {
    return NextResponse.json({ lead: null })
  }
}
