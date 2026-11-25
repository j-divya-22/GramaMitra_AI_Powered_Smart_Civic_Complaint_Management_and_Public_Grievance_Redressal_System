import { Bot, Loader2, Mic, MicOff, Volume2, VolumeX } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';

export default function VoiceCoach({
  language,
  prompt,
  status,
  isSpeaking,
  isListening,
  isInstalling,
  offlineStatus,
  voiceEnabled,
  onToggleVoice,
  onListen,
  onInstallOffline,
}) {
  const reduceMotion = useReducedMotion();

  return (
    <section className="flex items-start gap-4 rounded-3xl border border-neutral-light bg-surface-card/90 p-4 shadow-card backdrop-blur-sm sm:p-5" aria-label="Gramamitra voice guide">
      <motion.div
        animate={reduceMotion ? {} : {
          y: [0, -4, 0],
          scale: isSpeaking ? [1, 1.06, 1] : 1,
        }}
        transition={{ duration: isSpeaking ? 0.8 : 3.2, repeat: Infinity, ease: 'easeInOut' }}
        className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-brand-ink text-saffron shadow-saffron"
        aria-hidden="true"
      >
        {isSpeaking ? <Loader2 className="h-7 w-7 animate-spin" /> : <Bot className="h-8 w-8" strokeWidth={1.5} />}
      </motion.div>

      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <p className="text-sm font-bold text-brand-ink">Gramamitra</p>
            <p className="text-xs text-neutral-muted">
              {isListening ? 'Listening…' : isSpeaking ? 'Speaking…' : language ? 'Your voice guide' : 'Language guide'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onToggleVoice}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-saffron-light text-brand-ink transition hover:bg-saffron/25"
              aria-label={voiceEnabled ? 'Turn spoken guidance off' : 'Turn spoken guidance on'}
              aria-pressed={voiceEnabled}
              title={voiceEnabled ? 'Turn spoken guidance off' : 'Turn spoken guidance on'}
            >
              {voiceEnabled
                ? <Volume2 className="h-4 w-4" aria-hidden="true" />
                : <VolumeX className="h-4 w-4" aria-hidden="true" />}
            </button>
            <button
              type="button"
              onClick={isListening ? undefined : onListen}
              disabled={isListening}
              className={`inline-flex h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-bold text-white transition disabled:opacity-70 ${
                isListening ? 'bg-error' : 'bg-brand-ink hover:bg-brand-ink-dark'
              }`}
              aria-label={isListening ? 'Listening for your answer' : 'Answer Gramamitra by voice'}
            >
              {isListening ? <MicOff className="h-4 w-4" aria-hidden="true" /> : <Mic className="h-4 w-4" aria-hidden="true" />}
              {isListening ? 'Listening' : 'Speak'}
            </button>
          </div>
        </div>

        <p className="mt-3 text-sm leading-relaxed text-neutral-text" aria-live="polite">{status || prompt}</p>
        {offlineStatus === 'downloadable' && onInstallOffline && (
          <button
            type="button"
            onClick={onInstallOffline}
            disabled={isInstalling}
            className="mt-3 rounded-full border border-brand-ink/20 px-4 py-2 text-xs font-semibold text-brand-ink transition hover:bg-brand-ink/5 disabled:opacity-60"
          >
            {isInstalling ? 'Setting up offline voice…' : 'Set up offline voice'}
          </button>
        )}
      </div>
    </section>
  );
}
