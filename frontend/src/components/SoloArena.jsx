import { useState, useEffect, useRef, useCallback } from 'react';
import { io } from 'socket.io-client';
import { Bot, Square, AlertCircle, BookOpen, Loader2 } from 'lucide-react';
import FileUploader from './FileUploader';
import { DEBATE_MODELS } from '../lib/debateModels';
import api from '../services/api';

/**
 * SoloArena
 * -----------------------------------------------------------------------------
 * Single-player AI debate page.
 *
 * Flow:
 * 1) User uploads a PDF and enters a debate topic + picks an AI model.
 * 2) Frontend sends a multipart POST to /api/debate.
 * 3) Backend streams each debate turn over Socket.IO (debate_turn events).
 * 4) Frontend renders each turn in real time with a typewriter effect.
 * 5) On debate_complete / debate_error the session ends.
 */
const SoloArena = () => {
  // --- Upload form state ---
  const [selectedFile, setSelectedFile] = useState(null);
  const [topic, setTopic] = useState('');
  const [selectedModel, setSelectedModel] = useState('gemini-2.5-flash');

  // --- Debate session state ---
  const [isLoading, setIsLoading] = useState(false);
  const [debateStarted, setDebateStarted] = useState(false);
  const [turns, setTurns] = useState([]);
  const [statusMsg, setStatusMsg] = useState('');
  const [errorMsg, setErrorMsg] = useState('');
  const [isComplete, setIsComplete] = useState(false);

  const socketRef = useRef(null);
  const chatContainerRef = useRef(null);
  const socketIdRef = useRef(null);

  // Auto-scroll to newest message.
  useEffect(() => {
    if (chatContainerRef.current) {
      chatContainerRef.current.scrollTop = chatContainerRef.current.scrollHeight;
    }
  }, [turns, statusMsg]);

  // Clean up socket on unmount.
  useEffect(() => {
    return () => {
      if (socketRef.current) {
        socketRef.current.disconnect();
      }
    };
  }, []);

  const stopDebate = useCallback(() => {
    if (!socketRef.current || !socketIdRef.current) return;
    socketRef.current.emit('cancel_debate', { socketId: socketIdRef.current });
    setIsLoading(false);
  }, []);

  const handleStartDebate = async () => {
    if (!selectedFile) {
      setErrorMsg('Please select a PDF document first.');
      return;
    }
    if (!topic.trim()) {
      setErrorMsg('Please enter a debate topic.');
      return;
    }

    setErrorMsg('');
    setTurns([]);
    setIsComplete(false);
    setIsLoading(true);
    setDebateStarted(true);
    setStatusMsg('Connecting to debate engine…');

    // Create a dedicated socket for this solo session.
    const socket = io(import.meta.env.VITE_BACKEND_URL || 'http://localhost:5000', {
      transports: ['polling', 'websocket'],
      reconnectionAttempts: 3,
    });
    socketRef.current = socket;

    socket.on('connect', async () => {
      socketIdRef.current = socket.id;
      setStatusMsg('Uploading document and starting debate…');

      try {
        const formData = new FormData();
        formData.append('document', selectedFile);
        formData.append('topic', topic.trim());
        formData.append('socketId', socket.id);
        formData.append('model', selectedModel);
        formData.append('totalRounds', '3');

        await api.post('/debate', formData, {
          headers: { 'Content-Type': 'multipart/form-data' },
        });
      } catch (err) {
        setErrorMsg(err?.response?.data?.message || 'Failed to start the debate. Please try again.');
        setIsLoading(false);
        socket.disconnect();
      }
    });

    socket.on('debate_status', ({ rounds }) => {
      setStatusMsg(`Debate started — ${rounds} round${rounds !== 1 ? 's' : ''}`);
    });

    socket.on('debate_turn', (turn) => {
      setTurns((prev) => [...prev, turn]);
      setStatusMsg('');
    });

    socket.on('debate_complete', () => {
      setIsLoading(false);
      setIsComplete(true);
      setStatusMsg('Debate complete!');
      socket.disconnect();
    });

    socket.on('debate_error', ({ message }) => {
      setErrorMsg(message || 'An error occurred during the debate.');
      setIsLoading(false);
      socket.disconnect();
    });

    socket.on('connect_error', (err) => {
      setErrorMsg(`Connection error: ${err.message}`);
      setIsLoading(false);
    });
  };

  const handleReset = () => {
    if (isLoading) stopDebate();
    setSelectedFile(null);
    setTopic('');
    setSelectedModel('gemini-2.5-flash');
    setTurns([]);
    setIsComplete(false);
    setIsLoading(false);
    setDebateStarted(false);
    setStatusMsg('');
    setErrorMsg('');
    if (socketRef.current) {
      socketRef.current.disconnect();
      socketRef.current = null;
    }
    socketIdRef.current = null;
  };

  const modelLabel = DEBATE_MODELS.find((m) => m.id === selectedModel)?.label || selectedModel;

  return (
    <div className="min-h-[calc(100vh-64px)] bg-slate-950 text-slate-200 px-4 py-8">
      <div className="mx-auto max-w-5xl">
        {/* Header */}
        <div className="mb-8 text-center">
          <h1 className="text-4xl font-extrabold text-slate-100 flex items-center justify-center gap-3">
            <Bot className="h-9 w-9 text-cyan-400" />
            Solo AI Arena
          </h1>
          <p className="mt-2 text-slate-400 max-w-xl mx-auto text-sm">
            Upload a document, pick a topic, choose your AI model, and watch Gemini or Claude stage a
            structured Critic vs. Defender debate — powered by RAG.
          </p>
        </div>

        {!debateStarted ? (
          /* ── Setup panel ── */
          <div className="flex flex-col items-center gap-6">
            <FileUploader
              selectedFile={selectedFile}
              topic={topic}
              selectedModel={selectedModel}
              onFileSelect={setSelectedFile}
              onTopicChange={setTopic}
              onModelChange={setSelectedModel}
            />

            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-300 w-full max-w-xl">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errorMsg}
              </div>
            )}

            <button
              onClick={handleStartDebate}
              disabled={!selectedFile || !topic.trim()}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-cyan-600 px-8 py-4 font-bold text-white shadow-lg transition hover:opacity-90 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <BookOpen className="h-5 w-5" />
              Start Debate
            </button>
          </div>
        ) : (
          /* ── Live debate panel ── */
          <div className="flex flex-col gap-4">
            {/* Debate meta bar */}
            <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-slate-700 bg-slate-900 px-5 py-3 text-sm">
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Topic</span>
                <span className="font-semibold text-slate-200">{topic}</span>
              </div>
              <div className="flex flex-col gap-0.5">
                <span className="text-xs text-slate-500 uppercase tracking-wider">Model</span>
                <span className="font-semibold text-cyan-300">{modelLabel}</span>
              </div>
              {isLoading && (
                <button
                  onClick={stopDebate}
                  className="flex items-center gap-1.5 rounded-lg border border-red-500/40 bg-red-900/20 px-3 py-1.5 text-xs font-semibold text-red-300 hover:bg-red-900/40 transition"
                >
                  <Square className="h-3 w-3" /> Stop
                </button>
              )}
              {!isLoading && (
                <button
                  onClick={handleReset}
                  className="flex items-center gap-1.5 rounded-lg border border-slate-600 bg-slate-800 px-3 py-1.5 text-xs font-semibold text-slate-300 hover:bg-slate-700 transition"
                >
                  New Debate
                </button>
              )}
            </div>

            {/* Error */}
            {errorMsg && (
              <div className="flex items-center gap-2 rounded-lg border border-red-500/30 bg-red-900/20 px-4 py-3 text-sm text-red-300">
                <AlertCircle className="h-4 w-4 shrink-0" />
                {errorMsg}
                <button onClick={handleReset} className="ml-auto underline text-red-400 hover:text-red-300 text-xs">
                  Reset
                </button>
              </div>
            )}

            {/* Transcript */}
            <div
              ref={chatContainerRef}
              className="flex flex-col gap-4 overflow-y-auto rounded-xl border border-slate-700 bg-slate-900/80 p-5 h-[55vh]"
            >
              {turns.length === 0 && isLoading && (
                <div className="flex flex-col items-center justify-center gap-3 h-full text-slate-400">
                  <Loader2 className="h-8 w-8 animate-spin text-cyan-400" />
                  <span className="text-sm">{statusMsg || 'Initializing debate…'}</span>
                </div>
              )}

              {turns.map((turn, idx) => (
                <div
                  key={idx}
                  className={`rounded-xl px-5 py-4 max-w-[88%] shadow text-sm leading-relaxed whitespace-pre-wrap ${
                    turn.speaker === 'Critic'
                      ? 'self-start bg-rose-950/60 border border-rose-500/30 text-rose-100'
                      : turn.speaker === 'Defender'
                      ? 'self-end bg-indigo-950/60 border border-indigo-500/30 text-indigo-100'
                      : 'self-center bg-slate-800 border border-slate-600 text-slate-300 italic text-xs max-w-full'
                  }`}
                >
                  <span className="block text-[10px] font-bold uppercase tracking-widest mb-1 opacity-60">
                    {turn.speaker}
                  </span>
                  {turn.text}
                </div>
              ))}

              {isLoading && turns.length > 0 && (
                <div className="flex items-center gap-2 self-center text-slate-400 text-xs animate-pulse">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  {statusMsg || 'Generating next turn…'}
                </div>
              )}

              {isComplete && (
                <div className="self-center text-center text-xs text-emerald-400 font-semibold border border-emerald-500/30 bg-emerald-900/20 rounded-lg px-4 py-2">
                  ✓ Debate complete
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default SoloArena;
