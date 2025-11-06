import React, { useState, useEffect, useRef } from 'react';
import { GoogleGenAI, LiveServerMessage, Modality, Blob } from '@google/genai';
import { Persona, ChatMessage } from '../types';

// --- Prop Types ---
interface GroupCallPageProps {
  config: {
    topic: string;
    personas: Persona[];
  };
  onEndCall: (transcript: ChatMessage[]) => void;
}

// --- Audio Helper Functions from Gemini Documentation ---
function encode(bytes: Uint8Array): string {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string): Uint8Array {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioDataFromAPI(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);

  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

function createBlob(data: Float32Array): Blob {
  const l = data.length;
  const int16 = new Int16Array(l);
  for (let i = 0; i < l; i++) {
    int16[i] = data[i] * 32768;
  }
  return {
    data: encode(new Uint8Array(int16.buffer)),
    mimeType: 'audio/pcm;rate=16000',
  };
}

// --- Icons ---
const MicIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
    </svg>
);

const MicOffIcon = () => (
    <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
        <path strokeLinecap="round" strokeLinejoin="round" d="M5 5l14 14" />
    </svg>
);

// --- Main Component ---
const GroupCallPage: React.FC<GroupCallPageProps> = ({ config, onEndCall }) => {
  const [transcript, setTranscript] = useState<ChatMessage[]>([]);
  const [connectionStatus, setConnectionStatus] = useState('connecting');
  const [isMuted, setIsMuted] = useState(false);
  const [isModelSpeaking, setIsModelSpeaking] = useState(false);

  const sessionPromiseRef = useRef<Promise<any> | null>(null);
  const audioStreamRef = useRef<MediaStream | null>(null);
  const inputAudioContextRef = useRef<AudioContext | null>(null);
  const outputAudioContextRef = useRef<AudioContext | null>(null);
  const scriptProcessorRef = useRef<ScriptProcessorNode | null>(null);
  const mediaStreamSourceRef = useRef<MediaStreamAudioSourceNode | null>(null);

  const nextStartTimeRef = useRef(0);
  const audioSourcesRef = useRef(new Set<AudioBufferSourceNode>());

  const currentInputTranscriptionRef = useRef('');
  const currentOutputTranscriptionRef = useRef('');

  const transcriptContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (transcriptContainerRef.current) {
      transcriptContainerRef.current.scrollTop = transcriptContainerRef.current.scrollHeight;
    }
  }, [transcript]);

  useEffect(() => {
    let isMounted = true;
    
    const cleanup = () => {
        isMounted = false;
        sessionPromiseRef.current?.then(session => session.close());
        audioStreamRef.current?.getTracks().forEach(track => track.stop());
        scriptProcessorRef.current?.disconnect();
        mediaStreamSourceRef.current?.disconnect();
        inputAudioContextRef.current?.close().catch(() => {});
        outputAudioContextRef.current?.close().catch(() => {});
        for (const source of audioSourcesRef.current.values()) {
            source.stop();
        }
        audioSourcesRef.current.clear();
    };
    
    async function setupLiveSession() {
      if (!process.env.API_KEY) {
        setConnectionStatus('error');
        setTranscript(prev => [...prev, { sender: 'System', text: 'API Key not configured.' }]);
        return;
      }

      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      const systemInstruction = `You are a facilitator for a brainstorming session about '${config.topic}'. You will act as a group of AI personas. The personas are: ${config.personas.map(p => `\n- ${p.name}: ${p.description}`).join('')}. When you speak, please embody one of these personas and make it clear which one is talking. Keep the conversation flowing and collaborative.`;

      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        if (!isMounted) return;
        audioStreamRef.current = stream;

        inputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 16000 });
        outputAudioContextRef.current = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: 24000 });

        sessionPromiseRef.current = ai.live.connect({
          model: 'gemini-2.5-flash-native-audio-preview-09-2025',
          config: {
            responseModalities: [Modality.AUDIO],
            speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Zephyr' } } },
            systemInstruction: systemInstruction,
            inputAudioTranscription: {},
            outputAudioTranscription: {},
          },
          callbacks: {
            onopen: () => {
              if (!isMounted) return;
              setConnectionStatus('live');
              setTranscript(prev => [...prev, { sender: 'System', text: 'Connection opened. You can start speaking.' }]);

              const source = inputAudioContextRef.current!.createMediaStreamSource(stream);
              mediaStreamSourceRef.current = source;
              const scriptProcessor = inputAudioContextRef.current!.createScriptProcessor(4096, 1, 1);
              scriptProcessorRef.current = scriptProcessor;

              scriptProcessor.onaudioprocess = (audioProcessingEvent) => {
                if (isMuted) return;
                const inputData = audioProcessingEvent.inputBuffer.getChannelData(0);
                const pcmBlob = createBlob(inputData);
                sessionPromiseRef.current?.then((session) => {
                  session.sendRealtimeInput({ media: pcmBlob });
                });
              };

              source.connect(scriptProcessor);
              scriptProcessor.connect(inputAudioContextRef.current!.destination);
            },
            onmessage: async (message: LiveServerMessage) => {
                if (!isMounted) return;

                if (message.serverContent?.outputTranscription?.text) {
                    currentOutputTranscriptionRef.current += message.serverContent.outputTranscription.text;
                }
                if (message.serverContent?.inputTranscription?.text) {
                    currentInputTranscriptionRef.current += message.serverContent.inputTranscription.text;
                }
                
                if (message.serverContent?.turnComplete) {
                    if (currentInputTranscriptionRef.current.trim()) {
                        setTranscript(prev => [...prev, { sender: 'User', text: currentInputTranscriptionRef.current.trim() }]);
                    }
                    if (currentOutputTranscriptionRef.current.trim()) {
                        const personaName = config.personas.find(p => currentOutputTranscriptionRef.current.startsWith(p.name))?.name || 'Assistant';
                        setTranscript(prev => [...prev, { sender: personaName, text: currentOutputTranscriptionRef.current.trim() }]);
                    }
                    currentInputTranscriptionRef.current = '';
                    currentOutputTranscriptionRef.current = '';
                }

                const base64EncodedAudioString = message.serverContent?.modelTurn?.parts[0]?.inlineData?.data;
                if (base64EncodedAudioString) {
                    setIsModelSpeaking(true);
                    const outputCtx = outputAudioContextRef.current!;
                    nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                    const audioBuffer = await decodeAudioDataFromAPI(decode(base64EncodedAudioString), outputCtx, 24000, 1);
                    const source = outputCtx.createBufferSource();
                    source.buffer = audioBuffer;
                    source.connect(outputCtx.destination);
                    
                    source.addEventListener('ended', () => {
                        audioSourcesRef.current.delete(source);
                        if (audioSourcesRef.current.size === 0) setIsModelSpeaking(false);
                    });

                    source.start(nextStartTimeRef.current);
                    nextStartTimeRef.current += audioBuffer.duration;
                    audioSourcesRef.current.add(source);
                }
                
                if (message.serverContent?.interrupted) {
                    for (const source of audioSourcesRef.current.values()) source.stop();
                    audioSourcesRef.current.clear();
                    nextStartTimeRef.current = 0;
                    setIsModelSpeaking(false);
                }
            },
            onerror: (e: ErrorEvent) => {
              if (!isMounted) return;
              console.error(e);
              setConnectionStatus('error');
              setTranscript(prev => [...prev, { sender: 'System', text: 'An error occurred.' }]);
            },
            onclose: () => {
              if (isMounted) setConnectionStatus('ended');
            },
          },
        });
      } catch (err) {
        if (!isMounted) return;
        console.error(err);
        setConnectionStatus('error');
        setTranscript(prev => [...prev, { sender: 'System', text: 'Failed to access microphone.' }]);
      }
    }
    
    setupLiveSession();
    return cleanup;
  }, [config.topic, config.personas]);

  const handleEndCall = () => {
    onEndCall(transcript);
  };
  
  return (
    <div className="w-full max-w-4xl h-[90vh] flex flex-col bg-white dark:bg-gray-800 shadow-2xl rounded-2xl overflow-hidden">
      <div className="flex justify-between items-center p-4 border-b border-gray-200 dark:border-gray-700">
        <h1 className="text-xl font-bold text-gray-800 dark:text-white">{config.topic}</h1>
        <div className={`px-3 py-1 text-sm font-semibold rounded-full ${connectionStatus === 'live' ? 'bg-green-100 text-green-800' : 'bg-yellow-100 text-yellow-800'}`}>
          {connectionStatus.charAt(0).toUpperCase() + connectionStatus.slice(1)}
        </div>
      </div>
      
      <div className="flex items-center justify-center p-4 space-x-6 border-b border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-900/50">
        <div className="flex flex-col items-center text-center">
            <div className={`w-20 h-20 rounded-full flex items-center justify-center text-white font-bold bg-indigo-500 border-4 ${!isMuted ? 'border-green-500 animate-pulse-border' : 'border-transparent'} transition-all`}>YOU</div>
            <span className="mt-2 text-sm font-medium text-gray-800 dark:text-white">You</span>
        </div>
        {config.personas.map(p => (
            <div key={p.name} className="flex flex-col items-center text-center">
                <img src={p.avatarUrl} alt={p.name} className={`w-20 h-20 rounded-full object-cover border-4 ${isModelSpeaking ? 'border-blue-500 animate-pulse-border' : 'border-transparent'} transition-all`} />
                <span className="mt-2 text-sm font-medium text-gray-800 dark:text-white w-24 truncate">{p.name}</span>
            </div>
        ))}
      </div>

      <div ref={transcriptContainerRef} className="flex-1 overflow-y-auto p-6 space-y-4">
        {transcript.map((msg, index) => (
          <div key={index}>
            <p className="font-bold text-sm mb-1 text-gray-900 dark:text-white">{msg.sender}</p>
            <p className="text-gray-700 dark:text-gray-300 whitespace-pre-wrap">{msg.text}</p>
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t border-gray-200 dark:border-gray-700 flex justify-center items-center gap-6">
         <button onClick={() => setIsMuted(prev => !prev)} className={`p-4 rounded-full transition-colors ${!isMuted ? 'bg-blue-500 text-white' : 'bg-gray-300 dark:bg-gray-600'}`}>
            {isMuted ? <MicOffIcon /> : <MicIcon />}
         </button>
         <button onClick={handleEndCall} className="px-8 py-4 text-lg font-bold rounded-full text-white bg-red-600 hover:bg-red-700 transition-colors">
            End Call
         </button>
      </div>
      <style>{`
        @keyframes pulse-border {
          0%, 100% { box-shadow: 0 0 0 0 rgba(59, 130, 246, 0.7); }
          50% { box-shadow: 0 0 0 4px rgba(59, 130, 246, 0); }
        }
        .animate-pulse-border {
          animation: pulse-border 2s infinite;
        }
      `}</style>
    </div>
  );
};

export default GroupCallPage;
