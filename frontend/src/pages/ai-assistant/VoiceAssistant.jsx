import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import {
  ArrowLeft, Bot, Loader2, Mic, MicOff, Pause, Play, Send, Square,
  Volume2, VolumeX,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useTranslation } from 'react-i18next';
import BilingualText from '../../components/i18n/BilingualText';

const getSpeechLanguage = (language) => {
  const languageTags = {
    en: 'en-IN',
    hi: 'hi-IN',
    kn: 'kn-IN',
    ta: 'ta-IN',
    te: 'te-IN',
    ml: 'ml-IN',
    mr: 'mr-IN',
    bn: 'bn-IN',
    gu: 'gu-IN',
    pa: 'pa-IN',
    ur: 'ur-IN',
    or: 'or-IN',
  };
  return languageTags[language] || language;
};

const getSpeechLanguageCandidates = (language) => {
  const preferredLanguage = getSpeechLanguage(language);
  return language === 'en' ? [preferredLanguage, 'en-US'] : [preferredLanguage];
};

export default function VoiceAssistant() {
  const { language } = useLanguage();
  const { t } = useTranslation();
  const reduceMotion = useReducedMotion();
  const [isListening, setIsListening] = useState(false);
  const [isRequestingMic, setIsRequestingMic] = useState(false);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [transcript, setTranscript] = useState('');
  const [notice, setNotice] = useState('');
  const [response, setResponse] = useState('Namaste! I’m Gramamitra. Tell me what you need help with.');
  const [offlineSpeechStatus, setOfflineSpeechStatus] = useState('checking');
  const [offlineSpeechLanguage, setOfflineSpeechLanguage] = useState('');
  const [isInstallingSpeechPack, setIsInstallingSpeechPack] = useState(false);
  const recognitionRef = useRef(null);
  const translate = (english) => t(english, { defaultValue: english, keySeparator: false });

  useEffect(() => () => {
    window.speechSynthesis?.cancel();
    recognitionRef.current?.abort();
  }, []);

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (typeof Recognition?.available !== 'function') {
      setOfflineSpeechStatus('unsupported');
      return undefined;
    }

    let active = true;
    setOfflineSpeechStatus('checking');
    setOfflineSpeechLanguage('');

    const checkLanguagePacks = async () => {
      for (const candidate of getSpeechLanguageCandidates(language)) {
        try {
          const status = await Recognition.available({
            langs: [candidate],
            processLocally: true,
            quality: 'dictation',
          });
          if (status !== 'unavailable') {
            if (active) {
              setOfflineSpeechLanguage(candidate);
              setOfflineSpeechStatus(status);
            }
            return;
          }
        } catch {
          continue;
        }
      }
      if (active) setOfflineSpeechStatus('unavailable');
    };

    checkLanguagePacks();

    return () => { active = false; };
  }, [language]);

  const speak = (text = response) => {
    if (!('speechSynthesis' in window)) {
      setNotice('Speech playback is not supported in this browser.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(text);
    utterance.lang = language;
    utterance.onstart = () => {
      setIsSpeaking(true);
      setIsPaused(false);
      setNotice('');
    };
    utterance.onend = () => {
      setIsSpeaking(false);
      setIsPaused(false);
    };
    utterance.onerror = () => {
      setIsSpeaking(false);
      setNotice('Could not play speech. You can still read the response on screen.');
    };
    window.speechSynthesis.speak(utterance);
  };

  const microphoneErrorMessage = (error) => {
    if (error?.name === 'NotAllowedError' || error?.name === 'PermissionDeniedError') {
      return 'Microphone access is blocked for this site. Allow Microphone for localhost in your browser’s site settings, then try again.';
    }
    if (error?.name === 'NotFoundError' || error?.name === 'DevicesNotFoundError') {
      return 'No microphone was found. Connect a microphone or type your message instead.';
    }
    if (error?.name === 'NotReadableError' || error?.name === 'TrackStartError') {
      return 'Your microphone is busy in another app. Close the other app and try again.';
    }
    if (error?.name === 'SecurityError') {
      return 'Microphone access requires a secure page. Open Gramamitra on localhost or HTTPS.';
    }
    return 'Could not start voice input. Check your microphone and browser permission, or type your message.';
  };

  const toggleListening = () => {
    if (isListening) {
      recognitionRef.current?.stop();
      setIsListening(false);
      return;
    }

    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setNotice('Voice input is not supported in this browser. Type your message below instead.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = offlineSpeechStatus === 'available' && offlineSpeechLanguage
      ? offlineSpeechLanguage
      : getSpeechLanguage(language);
    recognition.interimResults = false;
    recognition.continuous = false;
    if ('processLocally' in recognition && offlineSpeechStatus === 'available') {
      recognition.processLocally = true;
    }
    recognition.onstart = () => {
      setIsListening(true);
      setIsRequestingMic(false);
      setNotice('');
    };
    recognition.onresult = (event) => {
      const spokenText = event.results[0][0].transcript;
      setTranscript(spokenText);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      setIsRequestingMic(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setNotice('Microphone access is blocked for this site. Allow Microphone for localhost in your browser’s site settings, then try again.');
      } else if (event.error === 'audio-capture') {
        setNotice('No usable microphone was found. Connect or enable a microphone, or type your message.');
      } else if (event.error === 'network') {
        setNotice(offlineSpeechStatus === 'downloadable'
          ? 'Online speech recognition could not connect. Set up on-device speech once to use your microphone without that service.'
          : offlineSpeechStatus === 'downloading'
            ? 'The on-device speech pack is still downloading. Try again when setup finishes, or type your message.'
            : 'Online speech recognition could not connect. You can try again later or type your message.');
      } else if (event.error === 'no-speech') {
        setNotice('No speech was detected. Try again in a quieter place or type your message.');
      } else if (event.error === 'language-not-supported') {
        setNotice(offlineSpeechStatus === 'downloadable'
          ? 'This language needs an on-device speech pack. Set it up below, then try again.'
          : 'Speech recognition for this language is not available in this browser. You can still type your message.');
      } else if (event.error !== 'aborted') {
        setNotice('Voice input could not start. Check your microphone and browser settings, or type your message.');
      }
    };
    recognition.onend = () => {
      setIsListening(false);
      setIsRequestingMic(false);
    };
    recognitionRef.current = recognition;

    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setNotice('Microphone access requires a secure page. Open Gramamitra on localhost or HTTPS.');
      return;
    }

    setIsRequestingMic(true);
    try {
      recognition.start();
    } catch (error) {
      setNotice(microphoneErrorMessage(error));
      setIsRequestingMic(false);
    }
  };

  const installOfflineSpeech = async () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (typeof Recognition?.install !== 'function') {
      setNotice('On-device speech setup is not supported in this browser. Use typed input or try a supported browser.');
      return;
    }

    const languageToInstall = offlineSpeechLanguage || getSpeechLanguage(language);
    setIsInstallingSpeechPack(true);
    setNotice('Downloading the selected language pack. It stays on this device for offline speech recognition.');
    try {
      const installed = await Recognition.install({
        langs: [languageToInstall],
        quality: 'dictation',
      });
      if (!installed) throw new Error('The browser could not install this language pack.');

      const status = await Recognition.available({
        langs: [languageToInstall],
        processLocally: true,
        quality: 'dictation',
      });
      setOfflineSpeechLanguage(languageToInstall);
      setOfflineSpeechStatus(status);
      if (status !== 'available') throw new Error('The language pack is not available for on-device recognition.');
      setNotice('On-device speech is ready. Tap the microphone to try again; your audio will be processed on this device.');
    } catch (error) {
      setNotice(error.message || 'Could not set up on-device speech. Typed input remains available.');
    } finally {
      setIsInstallingSpeechPack(false);
    }
  };

  const sendMessage = (event) => {
    event.preventDefault();
    const text = transcript.trim();
    if (!text) return;
    setResponse(`I heard: “${text}”. This assistant screen is a frontend preview; connect the AI service to receive a generated answer.`);
    setTranscript('');
    setNotice('');
  };

  const togglePause = () => {
    if (!('speechSynthesis' in window)) return;
    if (isPaused) {
      window.speechSynthesis.resume();
      setIsPaused(false);
    } else if (isSpeaking) {
      window.speechSynthesis.pause();
      setIsPaused(true);
    } else {
      speak();
    }
  };

  const stop = () => {
    window.speechSynthesis?.cancel();
    recognitionRef.current?.abort();
    setIsListening(false);
    setIsSpeaking(false);
    setIsPaused(false);
  };

  return (
    <div className="min-h-screen bg-surface-canvas pb-14">
      <main className="mx-auto max-w-5xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-7 flex items-center justify-between gap-3">
          <Link to="/dashboard" className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-neutral-muted transition hover:bg-neutral-light hover:text-brand-ink">
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Dashboard
          </Link>
          <span className="rounded-full bg-saffron-light/50 px-3 py-1.5 text-xs font-bold text-brand-ink"><BilingualText english="Assistant preview" /></span>
        </div>

        <section className="overflow-hidden rounded-3xl border border-neutral-light bg-surface-card shadow-premium">
          <div className="grid lg:grid-cols-[0.85fr_1.15fr]">
            <div className="flex min-h-[420px] flex-col items-center justify-center bg-brand-ink px-6 py-10 text-center text-surface-canvas sm:px-10">
              <motion.div
                animate={reduceMotion ? {} : {
                  y: [0, -7, 0],
                  rotate: isListening ? [0, -2, 2, 0] : 0,
                  scale: isSpeaking ? [1, 1.04, 1] : 1,
                }}
                transition={{ duration: isSpeaking ? 0.8 : 4, repeat: Infinity, ease: 'easeInOut' }}
                className="relative mb-8 flex h-36 w-36 items-center justify-center rounded-[2.25rem] border border-white/10 bg-white/[0.08] shadow-saffron"
              >
                <div className="absolute inset-3 rounded-[1.75rem] border border-saffron/20" aria-hidden="true" />
                <Bot className="relative h-20 w-20 text-saffron" strokeWidth={1.4} aria-hidden="true" />
                <motion.span
                  animate={reduceMotion ? {} : { scale: isSpeaking ? [1, 1.2, 0.9, 1] : [1, 1.08, 1] }}
                  transition={{ duration: isSpeaking ? 0.42 : 2.4, repeat: Infinity }}
                  className="absolute bottom-7 left-1/2 h-1.5 w-7 -translate-x-1/2 rounded-full bg-saffron"
                />
                {isSpeaking && (
                  <span className="absolute -bottom-5 flex items-center gap-1" aria-hidden="true">
                    {[0, 1, 2, 3, 4].map((bar) => (
                      <motion.span
                        key={bar}
                        animate={reduceMotion ? {} : { height: [5, 15, 7, 12, 5] }}
                        transition={{ duration: 0.55, delay: bar * 0.07, repeat: Infinity }}
                        className="w-1 rounded-full bg-saffron"
                      />
                    ))}
                  </span>
                )}
              </motion.div>
              <p className="text-xs font-bold uppercase tracking-[0.2em] text-saffron"><BilingualText english="Your Gramamitra companion" /></p>
              <h1 className="mt-3 font-display text-3xl font-bold text-surface-canvas"><BilingualText english="Speak freely." /></h1>
              <p className="mt-3 max-w-sm text-sm leading-relaxed text-surface-canvas/70">
                <BilingualText english="Use your voice or type a message. The animated assistant can read its on-screen response aloud." />
              </p>
            </div>

            <div className="flex flex-col p-5 sm:p-8 lg:p-10">
              <div className="flex flex-1 flex-col justify-center">
                <div className="mb-6 flex items-center gap-3">
                  <span className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-ink/5 text-brand-ink">
                    <Bot className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <div>
                    <p className="text-sm font-bold text-neutral-text">Gramamitra</p>
                    <p className="text-xs text-neutral-muted">
                      <BilingualText english={isRequestingMic ? 'Requesting microphone permission…' : isListening ? 'Listening to you…' : isSpeaking ? 'Speaking…' : 'Ready when you are'} />
                    </p>
                  </div>
                  {isSpeaking && <Loader2 className="ml-auto h-4 w-4 animate-spin text-saffron-muted" aria-hidden="true" />}
                </div>

                <motion.div
                  key={response}
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-2xl rounded-tl-sm bg-white p-5 text-sm leading-relaxed text-neutral-text shadow-card sm:text-base"
                  aria-live="polite"
                >
                  <BilingualText english={response} />
                </motion.div>

                <p className="mt-3 text-right text-[11px] text-neutral-muted"><BilingualText english="AI replies need a connected backend service." /></p>

                <div className="mt-6 flex items-center justify-center gap-3">
                  <button
                    type="button"
                    onClick={toggleListening}
                    disabled={isRequestingMic}
                    aria-label={isListening ? 'Stop listening' : 'Start voice input'}
                    className={`flex h-14 w-14 items-center justify-center rounded-full transition ${
                      isListening ? 'bg-error text-white shadow-lg shadow-error/20' : 'bg-brand-ink text-white shadow-saffron hover:bg-brand-ink-dark'
                    }`}
                  >
                    {isRequestingMic ? <Loader2 className="h-5 w-5 animate-spin" /> : isListening ? <MicOff className="h-5 w-5" /> : <Mic className="h-5 w-5" />}
                  </button>
                  <button type="button" onClick={togglePause} aria-label={isPaused ? 'Resume speech' : 'Pause or play speech'} className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-light text-brand-ink transition hover:bg-brand-ink/10">
                    {isPaused ? <Play className="h-4 w-4" /> : <Pause className="h-4 w-4" />}
                  </button>
                  <button type="button" onClick={stop} aria-label="Stop voice assistant" className="flex h-11 w-11 items-center justify-center rounded-full bg-neutral-light text-neutral-muted transition hover:bg-error/10 hover:text-error">
                    <Square className="h-4 w-4" />
                  </button>
                  <button type="button" onClick={() => speak()} aria-label={isSpeaking ? 'Voice is on' : 'Read response aloud'} className="flex h-11 w-11 items-center justify-center rounded-full bg-saffron-light/50 text-brand-ink transition hover:bg-saffron-light">
                    {isSpeaking ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
                  </button>
                </div>

                <form onSubmit={sendMessage} className="mt-8">
                  <label htmlFor="assistant-message" className="mb-2 block text-xs font-bold text-neutral-text"><BilingualText english="Type a message" /></label>
                  <div className="flex items-end gap-2 rounded-2xl border border-neutral-light bg-white p-2 transition focus-within:border-brand-ink focus-within:ring-4 focus-within:ring-brand-ink/10">
                    <textarea
                      id="assistant-message"
                      value={transcript}
                      onChange={(event) => setTranscript(event.target.value)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && !event.shiftKey) {
                          event.preventDefault();
                          sendMessage(event);
                        }
                      }}
                      rows={2}
                      placeholder={translate('How can I help?')}
                      className="max-h-32 min-h-12 flex-1 resize-y border-0 bg-transparent px-3 py-2 text-sm outline-none"
                    />
                    <button type="submit" disabled={!transcript.trim()} aria-label="Send message" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-brand-ink text-white transition hover:bg-brand-ink-dark disabled:cursor-not-allowed disabled:opacity-40">
                      <Send className="h-4 w-4" aria-hidden="true" />
                    </button>
                  </div>
                </form>

                {notice && (
                  <div role="status" className="mt-4 rounded-xl bg-warning/5 p-3 text-xs leading-relaxed text-warning">
                    <p>{notice}</p>
                    {offlineSpeechStatus === 'downloadable' && (
                      <button
                        type="button"
                        onClick={installOfflineSpeech}
                        disabled={isInstallingSpeechPack}
                        className="mt-3 rounded-full bg-brand-ink px-4 py-2 font-semibold text-surface-canvas transition hover:bg-brand-ink-dark disabled:opacity-60"
                      >
                        <BilingualText english={isInstallingSpeechPack ? 'Setting up offline speech…' : 'Set up offline speech'} />
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}
