/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useEffect, useRef, useState } from 'react';
import {
  Send,
  Trash2,
  Sparkles,
  Bot,
  User,
  ShieldCheck,
  AlertCircle,
  Loader2,
  Cpu,
} from 'lucide-react';
import {
  askAssistant,
  AssistantContext,
  ChatMessage,
  SUGGESTED_QUESTIONS,
} from '../lib/assistant.ts';
import { CLINICAL_DISCLAIMER } from '../config.ts';

interface ChatPanelProps {
  initialContext?: AssistantContext;
  heightClass?: string;
}

export const ChatPanel: React.FC<ChatPanelProps> = ({
  initialContext,
  heightClass = 'h-[580px]',
}) => {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome_1',
      role: 'assistant',
      content:
        'Hello! I am the ScanKavach Assistant. I can explain your screening scores, borderline flags, safety gate checks, decision support findings, and bank calibration in plain language.',
      timestamp: new Date().toISOString(),
    },
  ]);
  const [input, setInput] = useState('');
  const [isTyping, setIsTyping] = useState(false);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement | null>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages, isTyping]);

  const handleSend = async (queryText?: string) => {
    const textToSend = (queryText || input).trim();
    if (!textToSend || isTyping) return;

    setInput('');
    const userMsg: ChatMessage = {
      id: `user_${Date.now()}`,
      role: 'user',
      content: textToSend,
      timestamp: new Date().toISOString(),
    };

    setMessages((prev) => [...prev, userMsg]);
    setIsTyping(true);

    try {
      const response = await askAssistant(textToSend, [...messages, userMsg], initialContext);
      if (response.offlineFallback) {
        setIsOfflineMode(true);
      }

      const botMsg: ChatMessage = {
        id: `bot_${Date.now()}`,
        role: 'assistant',
        content: response.text,
        timestamp: new Date().toISOString(),
        offlineFallback: response.offlineFallback,
      };

      setMessages((prev) => [...prev, botMsg]);
    } catch (err) {
      console.error('Chat error:', err);
      const errorMsg: ChatMessage = {
        id: `err_${Date.now()}`,
        role: 'assistant',
        content:
          'An unexpected error occurred while generating a response. Please try asking again.',
        timestamp: new Date().toISOString(),
      };
      setMessages((prev) => [...prev, errorMsg]);
    } finally {
      setIsTyping(false);
    }
  };

  const handleClear = () => {
    setMessages([
      {
        id: `welcome_${Date.now()}`,
        role: 'assistant',
        content: 'Chat cleared. How can I help you interpret your screening results today?',
        timestamp: new Date().toISOString(),
      },
    ]);
  };

  return (
    <div
      className={`flex flex-col rounded-2xl border border-slate-800 bg-slate-900/90 shadow-xl overflow-hidden ${heightClass}`}
    >
      {/* Header with Mode Pill and Clear Button */}
      <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/80 px-4 py-3">
        <div className="flex items-center gap-2.5">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/20 text-teal-400 border border-teal-500/30">
            <Bot size={18} />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-slate-100">
                ScanKavach Assistant
              </span>
              {isOfflineMode ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-800 px-2 py-0.5 text-[10px] font-medium text-slate-400 border border-slate-700">
                  <Cpu size={10} />
                  <span>Using offline assistant</span>
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 rounded-full bg-teal-500/10 px-2 py-0.5 text-[10px] font-medium text-teal-400 border border-teal-500/20">
                  <Sparkles size={10} />
                  <span>AI Connected</span>
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-400">
              Only text summaries are sent to the AI. Scans never leave your device.
            </p>
          </div>
        </div>

        <button
          onClick={handleClear}
          className="inline-flex items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-2.5 py-1 text-xs text-slate-400 hover:text-rose-400 hover:border-rose-500/30 transition-colors"
          title="Clear conversation history"
        >
          <Trash2 size={13} />
          <span className="hidden sm:inline">Clear</span>
        </button>
      </div>

      {/* Persistent Clinical Disclaimer Banner */}
      <div className="flex items-center gap-2 border-b border-amber-500/20 bg-amber-500/10 px-4 py-2 text-[11px] text-amber-300">
        <AlertCircle size={13} className="shrink-0 text-amber-400" />
        <span>{CLINICAL_DISCLAIMER}</span>
      </div>

      {/* Active Scan Context Tag (if provided) */}
      {initialContext?.fileName && (
        <div className="flex items-center justify-between border-b border-slate-800 bg-slate-950/40 px-4 py-1.5 text-xs text-slate-300">
          <div className="flex items-center gap-2">
            <span className="text-slate-400">Active Scan Context:</span>
            <span className="font-semibold text-teal-300 font-mono">
              {initialContext.fileName}
            </span>
            {initialContext.verdict && (
              <span className="rounded bg-slate-800 px-1.5 py-0.5 text-[10px] uppercase font-mono">
                {initialContext.verdict}
              </span>
            )}
          </div>
          {initialContext.score !== undefined && (
            <span className="font-mono text-xs text-slate-400">
              Score: {initialContext.score.toFixed(3)}
            </span>
          )}
        </div>
      )}

      {/* Chat Messages Log */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.map((m) => {
          const isUser = m.role === 'user';
          return (
            <div
              key={m.id}
              className={`flex items-start gap-2.5 ${isUser ? 'flex-row-reverse' : 'flex-row'}`}
            >
              <div
                className={`flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-semibold ${
                  isUser
                    ? 'bg-teal-600 text-white'
                    : 'bg-slate-800 text-teal-400 border border-slate-700'
                }`}
              >
                {isUser ? <User size={14} /> : <Bot size={14} />}
              </div>

              <div
                className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-xs sm:text-sm leading-relaxed ${
                  isUser
                    ? 'bg-teal-600 text-white rounded-tr-none'
                    : 'bg-slate-800/90 text-slate-200 border border-slate-700/60 rounded-tl-none shadow-sm'
                }`}
              >
                <div className="whitespace-pre-wrap">{m.content}</div>
                <div
                  className={`mt-1 text-[9px] ${isUser ? 'text-teal-200 text-right' : 'text-slate-400'}`}
                >
                  {new Date(m.timestamp).toLocaleTimeString([], {
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                  {m.offlineFallback && (
                    <span className="ml-1.5 font-mono text-[9px] text-teal-400">
                      (local response)
                    </span>
                  )}
                </div>
              </div>
            </div>
          );
        })}

        {isTyping && (
          <div className="flex items-center gap-2 text-xs text-slate-400 pl-9">
            <Loader2 size={14} className="animate-spin text-teal-400" />
            <span>Assistant is thinking...</span>
          </div>
        )}

        <div ref={messagesEndRef} />
      </div>

      {/* Suggested Question Chips */}
      <div className="border-t border-slate-800/80 bg-slate-950/60 p-2.5">
        <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-400 mb-1.5 px-1">
          Suggested Questions:
        </div>
        <div className="flex flex-wrap gap-1.5">
          {SUGGESTED_QUESTIONS.map((q, idx) => (
            <button
              key={idx}
              onClick={() => handleSend(q)}
              disabled={isTyping}
              className="rounded-full bg-slate-900 px-3 py-1 text-xs text-teal-300 border border-slate-800 hover:border-teal-500/40 hover:bg-slate-800 transition-colors disabled:opacity-50"
            >
              {q}
            </button>
          ))}
        </div>
      </div>

      {/* Text Input Bar */}
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleSend();
        }}
        className="flex items-center gap-2 border-t border-slate-800 bg-slate-950 p-3"
      >
        <input
          type="text"
          value={input}
          onChange={(e) => setInput(e.target.value)}
          placeholder="Ask about anomaly thresholds, borderline scores, blur..."
          disabled={isTyping}
          className="flex-1 rounded-xl border border-slate-800 bg-slate-900 px-3.5 py-2 text-xs sm:text-sm text-slate-100 placeholder-slate-500 focus:border-teal-500 focus:outline-hidden focus:ring-1 focus:ring-teal-500"
        />
        <button
          type="submit"
          disabled={isTyping || !input.trim()}
          className="inline-flex h-9 w-9 items-center justify-center rounded-xl bg-teal-600 text-white hover:bg-teal-500 disabled:opacity-50 disabled:hover:bg-teal-600 transition-colors"
          aria-label="Send message"
        >
          <Send size={15} />
        </button>
      </form>
    </div>
  );
};
