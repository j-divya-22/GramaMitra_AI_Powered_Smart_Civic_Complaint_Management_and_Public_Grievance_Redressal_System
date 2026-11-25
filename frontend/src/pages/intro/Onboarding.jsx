import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowRight, Bot, Globe2 } from 'lucide-react';
import { motion, useReducedMotion } from 'framer-motion';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import { getSpeechLocale, getVoiceGuide, findLanguageFromSpeech } from '../../services/voiceGuide';
import useVoiceInput from '../../hooks/useVoiceInput';
import VoiceCoach from '../../components/voice/VoiceCoach';
import BilingualText from '../../components/i18n/BilingualText';

export default function Onboarding() {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const { setLanguage, supportedLanguages } = useLanguage();
  const voiceInput = useVoiceInput('en');
  const [selectedLanguage, setSelectedLanguage] = useState('');
  const [status, setStatus] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const navigationTimer = useRef(null);
  const voiceEnabledRef = useRef(true);
  const selectedLanguageRef = useRef('');
  const initialLanguage = useRef('en');
  const guideLanguage = selectedLanguage || 'en';

  const speak = useCallback((text, languageCode = 'en', onComplete) => {
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
      setStatus('Voice playback is unavailable here. Choose a language below to continue.');
      return false;
    }

    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = getSpeechLocale(languageCode);
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase() === utterance.lang.toLowerCase())
      || window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith(languageCode));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      setIsSpeaking(true);
      setStatus('');
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      onComplete?.();
    };
    utterance.onerror = (event) => {
      setIsSpeaking(false);
      if (event.error === 'canceled' || event.error === 'interrupted') return;
      setStatus('I could not play the voice prompt. You can still choose a language on screen.');
      onComplete?.();
    };
    window.speechSynthesis.speak(utterance);
    return true;
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      if (voiceEnabledRef.current) {
        speak(getVoiceGuide(initialLanguage.current).choose, initialLanguage.current);
      }
    }, 350);
    return () => {
      window.clearTimeout(timer);
      window.clearTimeout(navigationTimer.current);
      window.speechSynthesis?.cancel();
      voiceInput.stopListening();
    };
  }, [speak, voiceInput.stopListening]);

  const selectLanguage = (code) => {
    voiceInput.clearError();
    selectedLanguageRef.current = code;
    setSelectedLanguage(code);
    setLanguage(code);
    const confirmation = getVoiceGuide(code).selected;
    let hasNavigated = false;
    const continueToReport = () => {
      if (hasNavigated) return;
      hasNavigated = true;
      window.clearTimeout(navigationTimer.current);
      voiceInput.clearError();
      localStorage.setItem('janvani_returning_user', 'true');
      navigate('/report', { state: { voiceGuided: true } });
    };

    setStatus('Language selected. Gramamitra will guide you through your report next.');
    if (!voiceEnabledRef.current || !speak(confirmation, code, continueToReport)) {
      navigationTimer.current = window.setTimeout(continueToReport, 1200);
      return;
    }
    navigationTimer.current = window.setTimeout(continueToReport, 9000);
  };

  const handleSpokenLanguage = (transcript) => {
    const code = findLanguageFromSpeech(transcript);
    if (!code) {
      setStatus(`I heard “${transcript}”. Please say a language name, or choose it below.`);
      return;
    }
    selectLanguage(code);
  };

  const toggleVoice = () => {
    if (voiceEnabled) {
      voiceEnabledRef.current = false;
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      setVoiceEnabled(false);
      return;
    }

    voiceEnabledRef.current = true;
    setVoiceEnabled(true);
    const code = selectedLanguageRef.current || 'en';
    const prompt = selectedLanguageRef.current
      ? getVoiceGuide(code).selected
      : getVoiceGuide('en').choose;
    speak(prompt, code);
  };

  return (
    <main className="min-h-screen bg-surface-canvas px-4 py-8 text-neutral-text sm:px-6 lg:py-12">
      <div className="mx-auto max-w-6xl">
        <header className="mb-8 flex items-center gap-3">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-ink text-saffron shadow-saffron">
            <Bot className="h-7 w-7" aria-hidden="true" />
          </span>
          <div>
            <p className="font-display text-xl font-bold text-brand-ink">Gramamitra</p>
            <p className="text-sm text-neutral-muted"><BilingualText english="Let’s make your voice heard" /></p>
          </div>
        </header>

        <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:items-start">
          <section className="space-y-6">
            <div>
              <p className="inline-flex items-center gap-2 rounded-full bg-saffron-light px-4 py-2 text-xs font-bold uppercase tracking-[0.14em] text-saffron-muted">
                <Globe2 className="h-4 w-4" aria-hidden="true" />
                <BilingualText english="Your language, your voice" />
              </p>
              <h1 className="mt-5 font-display text-3xl font-bold leading-tight text-brand-ink sm:text-4xl">
                <BilingualText english="Which language should I speak with you?" />
              </h1>
              <p className="mt-3 text-base leading-relaxed text-neutral-muted">
                <BilingualText english="Say a language name or tap one below. After you choose, Gramamitra will open your report and guide you step by step." />
              </p>
            </div>

            <VoiceCoach
              language={guideLanguage}
              prompt={selectedLanguage ? getVoiceGuide(selectedLanguage).selected : getVoiceGuide('en').choose}
              status={voiceInput.error || status}
              isSpeaking={isSpeaking}
              isListening={voiceInput.isListening}
              isInstalling={voiceInput.isInstalling}
              offlineStatus={voiceInput.offlineStatus}
              voiceEnabled={voiceEnabled}
              onToggleVoice={toggleVoice}
              onListen={() => voiceInput.startListening(handleSpokenLanguage)}
              onInstallOffline={voiceInput.installOfflineSpeech}
            />

            {selectedLanguage && (
              <div role="status" className="rounded-2xl border border-success/20 bg-success/5 p-4 text-sm font-semibold text-success">
                <BilingualText
                  english="{{name}} selected. Moving to your report…"
                  values={{ name: supportedLanguages.find((item) => item.code === selectedLanguage)?.nativeName || '' }}
                />
              </div>
            )}
          </section>

          <section aria-label={t('Choose a language')} className="rounded-3xl border border-neutral-light bg-surface-card p-4 shadow-card sm:p-6">
            <h2 className="mb-4 font-display text-xl font-bold text-brand-ink"><BilingualText english="Choose a language" /></h2>
            <div className="grid gap-3 sm:grid-cols-2">
              {supportedLanguages.map((item, index) => (
                <motion.button
                  key={item.code}
                  type="button"
                  initial={{ opacity: 0, y: reduceMotion ? 0 : 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: reduceMotion ? 0 : 0.25, delay: reduceMotion ? 0 : index * 0.025 }}
                  onClick={() => selectLanguage(item.code)}
                  disabled={Boolean(selectedLanguage)}
                  className={`rounded-2xl border px-4 py-4 text-left transition hover:-translate-y-0.5 hover:border-brand-ink/40 hover:shadow-card disabled:cursor-wait disabled:opacity-70 ${
                    selectedLanguage === item.code
                      ? 'border-brand-ink bg-brand-ink text-white'
                      : 'border-neutral-light bg-surface-canvas/60 text-neutral-text'
                  }`}
                >
                  <span className="block text-lg font-bold">{item.nativeName}</span>
                  <span className={`mt-1 block text-xs ${selectedLanguage === item.code ? 'text-white/75' : 'text-neutral-muted'}`}>
                    {item.name} · {item.region}
                  </span>
                </motion.button>
              ))}
            </div>
            <p className="mt-5 text-xs leading-relaxed text-neutral-muted">
              <BilingualText english="Voice recognition and spoken voices depend on the language support available in your browser or device. You can always choose by touch." />
            </p>
            {selectedLanguage && (
              <p className="mt-4 flex items-center gap-2 text-sm font-semibold text-brand-ink">
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                <BilingualText english="Preparing the guided report…" />
              </p>
            )}
          </section>
        </div>
      </div>
    </main>
  );
}
