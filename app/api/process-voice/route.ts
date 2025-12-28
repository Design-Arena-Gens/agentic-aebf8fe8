import { NextRequest, NextResponse } from 'next/server'
import OpenAI from 'openai'

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY || 'dummy-key'
})

interface AppointmentDetails {
  patientName: string
  date: string
  time: string
  doctor: string
  confirmed: boolean
}

interface Message {
  role: 'assistant' | 'user'
  content: string
}

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const audioFile = formData.get('audio') as Blob
    const conversationHistory = JSON.parse(formData.get('conversationHistory') as string || '[]') as Message[]
    const appointmentDetails = JSON.parse(formData.get('appointmentDetails') as string || '{}') as AppointmentDetails

    // Convert audio to transcription
    const transcription = await transcribeAudio(audioFile)

    // Generate response based on conversation context
    const { response, updatedDetails } = await generateResponse(
      transcription,
      conversationHistory,
      appointmentDetails
    )

    return NextResponse.json({
      transcription,
      response,
      appointmentDetails: updatedDetails
    })
  } catch (error: any) {
    console.error('Voice processing error:', error)
    return NextResponse.json(
      { error: 'Failed to process voice input', details: error.message },
      { status: 500 }
    )
  }
}

async function transcribeAudio(audioBlob: Blob): Promise<string> {
  try {
    // Create a File object from the Blob
    const file = new File([audioBlob], 'recording.webm', { type: 'audio/webm' })

    const transcription = await openai.audio.transcriptions.create({
      file: file,
      model: 'whisper-1',
      language: 'en'
    })

    return transcription.text
  } catch (error: any) {
    console.error('Transcription error:', error)
    // Fallback for demo purposes
    return '[Audio transcription unavailable - using mock response]'
  }
}

async function generateResponse(
  userInput: string,
  conversationHistory: Message[],
  currentDetails: AppointmentDetails
): Promise<{ response: string; updatedDetails: AppointmentDetails }> {
  const systemPrompt = `You are a professional medical clinic appointment confirmation agent. Your job is to:
1. Confirm the patient's identity by getting their name
2. Verify their appointment details (date, time, doctor)
3. Ask if they can confirm the appointment
4. Handle rescheduling requests politely
5. Keep responses brief, friendly, and professional

Current appointment details gathered:
- Patient Name: ${currentDetails.patientName || 'Not yet provided'}
- Date: ${currentDetails.date || 'Not yet provided'}
- Time: ${currentDetails.time || 'Not yet provided'}
- Doctor: ${currentDetails.doctor || 'Not yet provided'}
- Confirmed: ${currentDetails.confirmed ? 'Yes' : 'No'}

IMPORTANT: Extract appointment information from the conversation naturally.
If the user provides their name, update patientName.
If they mention a date, update date.
If they confirm the appointment, set confirmed to true.

Respond in a conversational, empathetic manner. Keep responses under 2 sentences when possible.`

  try {
    const messages = [
      { role: 'system' as const, content: systemPrompt },
      ...conversationHistory.map(msg => ({
        role: msg.role as 'user' | 'assistant',
        content: msg.content
      })),
      { role: 'user' as const, content: userInput }
    ]

    const completion = await openai.chat.completions.create({
      model: 'gpt-4o-mini',
      messages: messages,
      temperature: 0.7,
      max_tokens: 150
    })

    const response = completion.choices[0].message.content || "I'm sorry, could you please repeat that?"

    // Extract updated appointment details from the conversation
    const updatedDetails = extractAppointmentDetails(userInput, response, currentDetails)

    return { response, updatedDetails }
  } catch (error: any) {
    console.error('OpenAI API error:', error)
    // Fallback response for demo
    return {
      response: mockResponse(userInput, currentDetails),
      updatedDetails: mockExtractDetails(userInput, currentDetails)
    }
  }
}

function extractAppointmentDetails(
  userInput: string,
  agentResponse: string,
  current: AppointmentDetails
): AppointmentDetails {
  const updated = { ...current }

  // Extract name (simple pattern matching)
  if (!updated.patientName) {
    const nameMatch = userInput.match(/(?:my name is|i'm|i am|this is)\s+([a-z]+(?:\s+[a-z]+)?)/i)
    if (nameMatch) {
      updated.patientName = nameMatch[1].trim()
    }
  }

  // Check for confirmation
  if (/\b(yes|confirm|correct|that'?s right|absolutely|sure)\b/i.test(userInput)) {
    updated.confirmed = true
  }

  // Extract date if mentioned by agent
  const dateMatch = agentResponse.match(/\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday|january|february|march|april|may|june|july|august|september|october|november|december)\s+\d{1,2}(?:st|nd|rd|th)?\b/i)
  if (dateMatch && !updated.date) {
    updated.date = dateMatch[0]
  }

  // Extract time if mentioned by agent
  const timeMatch = agentResponse.match(/\b\d{1,2}:\d{2}\s*(?:am|pm)\b/i)
  if (timeMatch && !updated.time) {
    updated.time = timeMatch[0]
  }

  // Extract doctor if mentioned
  const doctorMatch = agentResponse.match(/(?:dr\.?|doctor)\s+([a-z]+)/i)
  if (doctorMatch && !updated.doctor) {
    updated.doctor = 'Dr. ' + doctorMatch[1]
  }

  return updated
}

// Fallback functions for demo when API is unavailable
function mockResponse(userInput: string, details: AppointmentDetails): string {
  const input = userInput.toLowerCase()

  if (!details.patientName && input.includes('name')) {
    return "Thank you! I have your appointment scheduled for next Tuesday, January 14th at 2:30 PM with Dr. Smith. Can you confirm this appointment?"
  }

  if (input.includes('yes') || input.includes('confirm')) {
    return "Perfect! Your appointment is confirmed for Tuesday, January 14th at 2:30 PM with Dr. Smith. We'll see you then. Have a great day!"
  }

  if (input.includes('no') || input.includes('cancel') || input.includes('reschedule')) {
    return "I understand. Would you like to reschedule your appointment? I can help you find a new time that works better for you."
  }

  return "Thank you for that information. Can you confirm your appointment for next Tuesday at 2:30 PM?"
}

function mockExtractDetails(userInput: string, current: AppointmentDetails): AppointmentDetails {
  const updated = { ...current }
  const input = userInput.toLowerCase()

  if (!updated.patientName) {
    const nameMatch = userInput.match(/(?:my name is|i'm|i am|this is)\s+([a-z]+(?:\s+[a-z]+)?)/i)
    if (nameMatch) {
      updated.patientName = nameMatch[1].trim()
      updated.date = 'Tuesday, January 14th'
      updated.time = '2:30 PM'
      updated.doctor = 'Dr. Smith'
    }
  }

  if (input.includes('yes') || input.includes('confirm')) {
    updated.confirmed = true
  }

  return updated
}
