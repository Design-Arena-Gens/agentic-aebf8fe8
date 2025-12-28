'use client'

import { useState, useRef, useEffect } from 'react'

interface Message {
  role: 'assistant' | 'user'
  content: string
}

export default function Home() {
  const [isRecording, setIsRecording] = useState(false)
  const [isProcessing, setIsProcessing] = useState(false)
  const [messages, setMessages] = useState<Message[]>([])
  const [appointmentDetails, setAppointmentDetails] = useState({
    patientName: '',
    date: '',
    time: '',
    doctor: '',
    confirmed: false
  })

  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])
  const audioContextRef = useRef<AudioContext | null>(null)

  useEffect(() => {
    // Initial greeting
    const greeting = "Hello! I'm calling from your medical clinic to confirm your upcoming appointment. May I have your name please?"
    setMessages([{ role: 'assistant', content: greeting }])
    speakText(greeting)
  }, [])

  const speakText = async (text: string) => {
    try {
      const response = await fetch('/api/tts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ text })
      })

      if (response.ok) {
        const audioBlob = await response.blob()
        const audioUrl = URL.createObjectURL(audioBlob)
        const audio = new Audio(audioUrl)
        await audio.play()
      }
    } catch (error) {
      console.error('TTS Error:', error)
    }
  }

  const startRecording = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mediaRecorder = new MediaRecorder(stream, { mimeType: 'audio/webm' })

      mediaRecorderRef.current = mediaRecorder
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        const audioBlob = new Blob(audioChunksRef.current, { type: 'audio/webm' })
        await processAudio(audioBlob)
        stream.getTracks().forEach(track => track.stop())
      }

      mediaRecorder.start()
      setIsRecording(true)
    } catch (error) {
      console.error('Error accessing microphone:', error)
      alert('Please allow microphone access to use voice features')
    }
  }

  const stopRecording = () => {
    if (mediaRecorderRef.current && isRecording) {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
      setIsProcessing(true)
    }
  }

  const processAudio = async (audioBlob: Blob) => {
    try {
      const formData = new FormData()
      formData.append('audio', audioBlob, 'recording.webm')
      formData.append('conversationHistory', JSON.stringify(messages))
      formData.append('appointmentDetails', JSON.stringify(appointmentDetails))

      const response = await fetch('/api/process-voice', {
        method: 'POST',
        body: formData
      })

      const data = await response.json()

      setMessages(prev => [
        ...prev,
        { role: 'user', content: data.transcription },
        { role: 'assistant', content: data.response }
      ])

      if (data.appointmentDetails) {
        setAppointmentDetails(data.appointmentDetails)
      }

      await speakText(data.response)
    } catch (error) {
      console.error('Processing error:', error)
      const errorMsg = "I'm sorry, I didn't catch that. Could you please repeat?"
      setMessages(prev => [...prev, { role: 'assistant', content: errorMsg }])
      await speakText(errorMsg)
    } finally {
      setIsProcessing(false)
    }
  }

  return (
    <main className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="max-w-4xl mx-auto">
        <div className="bg-white rounded-2xl shadow-2xl overflow-hidden">
          {/* Header */}
          <div className="bg-gradient-to-r from-blue-600 to-indigo-600 p-6 text-white">
            <h1 className="text-3xl font-bold flex items-center gap-3">
              <svg className="w-8 h-8" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
              </svg>
              Medical Appointment Voice Agent
            </h1>
            <p className="mt-2 text-blue-100">Confirming appointments with voice interaction</p>
          </div>

          {/* Appointment Details Card */}
          {(appointmentDetails.patientName || appointmentDetails.date) && (
            <div className="m-6 p-4 bg-gradient-to-r from-green-50 to-emerald-50 rounded-xl border-2 border-green-200">
              <h3 className="font-semibold text-green-800 mb-2 flex items-center gap-2">
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Appointment Information
              </h3>
              <div className="grid grid-cols-2 gap-3 text-sm">
                {appointmentDetails.patientName && (
                  <div>
                    <span className="text-gray-600">Patient:</span>
                    <span className="ml-2 font-medium">{appointmentDetails.patientName}</span>
                  </div>
                )}
                {appointmentDetails.date && (
                  <div>
                    <span className="text-gray-600">Date:</span>
                    <span className="ml-2 font-medium">{appointmentDetails.date}</span>
                  </div>
                )}
                {appointmentDetails.time && (
                  <div>
                    <span className="text-gray-600">Time:</span>
                    <span className="ml-2 font-medium">{appointmentDetails.time}</span>
                  </div>
                )}
                {appointmentDetails.doctor && (
                  <div>
                    <span className="text-gray-600">Doctor:</span>
                    <span className="ml-2 font-medium">{appointmentDetails.doctor}</span>
                  </div>
                )}
              </div>
              {appointmentDetails.confirmed && (
                <div className="mt-3 p-2 bg-green-200 rounded-lg text-green-800 font-semibold text-center">
                  ✓ Appointment Confirmed
                </div>
              )}
            </div>
          )}

          {/* Conversation */}
          <div className="p-6 h-96 overflow-y-auto space-y-4">
            {messages.map((msg, idx) => (
              <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-xs lg:max-w-md px-4 py-3 rounded-2xl ${
                  msg.role === 'user'
                    ? 'bg-blue-600 text-white rounded-br-none'
                    : 'bg-gray-100 text-gray-800 rounded-bl-none'
                }`}>
                  <div className="flex items-start gap-2">
                    {msg.role === 'assistant' && (
                      <svg className="w-5 h-5 mt-0.5 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                      </svg>
                    )}
                    <p className="text-sm leading-relaxed">{msg.content}</p>
                  </div>
                </div>
              </div>
            ))}
            {isProcessing && (
              <div className="flex justify-start">
                <div className="bg-gray-100 px-4 py-3 rounded-2xl rounded-bl-none">
                  <div className="flex gap-2">
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="w-2 h-2 bg-gray-400 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Controls */}
          <div className="p-6 bg-gray-50 border-t border-gray-200">
            <div className="flex justify-center">
              <button
                onClick={isRecording ? stopRecording : startRecording}
                disabled={isProcessing}
                className={`flex items-center gap-3 px-8 py-4 rounded-full font-semibold text-white shadow-lg transform transition-all duration-200 ${
                  isRecording
                    ? 'bg-red-500 hover:bg-red-600 scale-110 animate-pulse'
                    : isProcessing
                    ? 'bg-gray-400 cursor-not-allowed'
                    : 'bg-blue-600 hover:bg-blue-700 hover:scale-105'
                }`}
              >
                {isProcessing ? (
                  <>
                    <svg className="w-6 h-6 animate-spin" fill="none" viewBox="0 0 24 24">
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                    </svg>
                    Processing...
                  </>
                ) : isRecording ? (
                  <>
                    <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 24 24">
                      <rect x="6" y="6" width="12" height="12" rx="2"></rect>
                    </svg>
                    Stop Recording
                  </>
                ) : (
                  <>
                    <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                    </svg>
                    Press to Speak
                  </>
                )}
              </button>
            </div>
            <p className="text-center text-sm text-gray-500 mt-4">
              {isRecording ? 'Listening... Click to stop' : isProcessing ? 'Processing your response...' : 'Click the button and speak clearly'}
            </p>
          </div>
        </div>
      </div>
    </main>
  )
}
