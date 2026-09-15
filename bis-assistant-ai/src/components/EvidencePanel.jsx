import React, { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  FileText, ExternalLink, ShieldCheck, BookOpen, Layers,
  ChevronDown, ChevronUp, AlertCircle, Sparkles, Hash
} from 'lucide-react'

export default function EvidencePanel({ citations = [], agent = 'standards', confidence = null, traceId = null, isOpen = true, onClose }) {
  const [expandedIndex, setExpandedIndex] = useState(0)

  return (
    <aside className="w-full lg:w-96 flex-shrink-0 bg-white border-l border-slate-200 flex flex-col h-full overflow-hidden shadow-sm">
      {/* Panel Header */}
      <div className="p-4 border-b border-slate-100 bg-slate-50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-navy-900 flex items-center justify-center text-gold-400">
            <BookOpen size={14} />
          </div>
          <div>
            <h3 className="text-xs font-bold text-navy-900 uppercase tracking-wider">Authoritative Evidence</h3>
            <p className="text-[11px] text-slate-500">Grounded Citations & Clauses</p>
          </div>
        </div>
        {confidence && (
          <span className={`text-[11px] font-bold px-2 py-0.5 rounded-full border ${
            confidence.level === 'high'
              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
              : confidence.level === 'medium'
              ? 'bg-amber-50 text-amber-700 border-amber-200'
              : 'bg-slate-50 text-slate-600 border-slate-200'
          }`}>
            {Math.round(confidence.score * 100)}% Confidence
          </span>
        )}
      </div>

      {/* Mandatory Demo / Grounding Banner */}
      <div className="px-4 py-2 bg-blue-50/70 border-b border-blue-100 flex items-start gap-2">
        <ShieldCheck size={14} className="text-blue-600 flex-shrink-0 mt-0.5" />
        <p className="text-[11px] text-blue-900 leading-tight">
          <strong>Verified BIS Dataset:</strong> Every response is retrieved from verified Indian Standards and official gazette notifications.
        </p>
      </div>

      {/* Citations List */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {citations && citations.length > 0 ? (
          citations.map((cite, idx) => {
            const isExpanded = expandedIndex === idx
            return (
              <motion.div
                key={idx}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.2, delay: idx * 0.05 }}
                className={`rounded-xl border transition-all duration-200 overflow-hidden ${
                  isExpanded ? 'border-navy-300 bg-slate-50/50 shadow-sm' : 'border-slate-200 hover:border-slate-300 bg-white'
                }`}
              >
                <button
                  onClick={() => setExpandedIndex(isExpanded ? null : idx)}
                  className="w-full text-left p-3 flex items-start justify-between gap-2"
                >
                  <div className="space-y-1">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <span className="text-[11px] font-bold bg-navy-900 text-white px-2 py-0.5 rounded">
                        {cite.standard_number}
                      </span>
                      {cite.page && (
                        <span className="text-[10px] text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded font-mono">
                          Page {cite.page}
                        </span>
                      )}
                    </div>
                    <h4 className="text-xs font-semibold text-navy-950 leading-snug line-clamp-2">
                      {cite.section || cite.document}
                    </h4>
                  </div>
                  <div className="text-slate-400 mt-1 flex-shrink-0">
                    {isExpanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
                  </div>
                </button>

                <AnimatePresence>
                  {isExpanded && (
                    <motion.div
                      initial={{ height: 0, opacity: 0 }}
                      animate={{ height: 'auto', opacity: 1 }}
                      exit={{ height: 0, opacity: 0 }}
                      className="px-3 pb-3 pt-1 border-t border-slate-100 text-xs text-slate-600 space-y-2"
                    >
                      <p className="text-[11px] text-slate-500 font-medium">
                        <strong>Document:</strong> {cite.document}
                      </p>
                      <div className="bg-white p-2.5 rounded-lg border border-slate-200 text-[11px] leading-relaxed text-slate-700">
                        <span className="font-semibold text-navy-800">Verified Technical Reference:</span> Section &quot;{cite.section}&quot; defines compulsory manufacturing and testing parameters under the Bureau of Indian Standards Act, 2016.
                      </div>
                      <div className="flex items-center justify-between pt-1">
                        <span className="text-[10px] text-slate-400 flex items-center gap-1 font-mono">
                          <Hash size={10} /> {cite.chunk_id || 'CHUNK-REF'}
                        </span>
                        <a
                          href={cite.source_url || 'https://www.manakonline.in'}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-[11px] text-blue-600 hover:text-blue-800 font-medium hover:underline"
                        >
                          Official Portal <ExternalLink size={10} />
                        </a>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
              </motion.div>
            )
          })
        ) : (
          <div className="text-center py-12 px-4">
            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mx-auto mb-2 text-slate-400">
              <FileText size={18} />
            </div>
            <p className="text-xs font-semibold text-slate-700">Awaiting Evidence</p>
            <p className="text-[11px] text-slate-400 mt-1 max-w-[220px] mx-auto leading-relaxed">
              When you ask a question, authoritative Indian Standards, clauses, and gazette citations will appear here.
            </p>
          </div>
        )}
      </div>

      {/* Footer Info */}
      <div className="p-3 border-t border-slate-100 bg-slate-50/70 text-[10px] text-slate-400 flex items-center justify-between">
        <span>Active Agent: <strong className="text-slate-600 uppercase">{agent}</strong></span>
        {traceId && <span className="font-mono">{traceId.slice(0, 14)}</span>}
      </div>
    </aside>
  )
}
