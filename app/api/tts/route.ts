import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
})

export async function POST(request: NextRequest) {
  try {
    const { text } = await request.json()

    if (!text) {
      return NextResponse.json(
        { error: 'Text is required' },
        { status: 400 }
      )
    }

    try {
      const mp3 = await openai.audio.speech.create({
        model: 'tts-1',
        voice: 'nova',
        input: text,
        speed: 1.0
      })

      const buffer = Buffer.from(await mp3.arrayBuffer())

      return new NextResponse(buffer, {
        headers: {
          'Content-Type': 'audio/mpeg',
          'Content-Length': buffer.length.toString()
        }
      })
    } catch (error: any) {
      console.error('OpenAI TTS error:', error)
      // Return silent audio as fallback
      return new NextResponse(null, { status: 204 })
    }
  } catch (error: any) {
    console.error('TTS error:', error)
    return NextResponse.json(
      { error: 'Failed to generate speech', details: error.message },
      { status: 500 }
    )
  }
}
