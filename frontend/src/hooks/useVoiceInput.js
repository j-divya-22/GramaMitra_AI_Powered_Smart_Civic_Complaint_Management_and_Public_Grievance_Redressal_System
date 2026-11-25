import { useCallback, useEffect, useRef, useState } from 'react';
import { getSpeechLocale } from '../services/voiceGuide';

export default function useVoiceInput(language) {
  const locale = getSpeechLocale(language);
  const recognitionRef = useRef(null);
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');
  const [offlineStatus, setOfflineStatus] = useState('checking');
  const [offlineLocale, setOfflineLocale] = useState(locale);
  const [isInstalling, setIsInstalling] = useState(false);

  useEffect(() => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (typeof Recognition?.available !== 'function') {
      setOfflineStatus('unsupported');
      return undefined;
    }

    let active = true;
    setOfflineStatus('checking');
    const candidates = locale === 'en-IN' ? ['en-IN', 'en-US'] : [locale];
    setOfflineLocale(candidates[0]);
    const checkLanguagePacks = async () => {
      for (const candidate of candidates) {
        try {
          const status = await Recognition.available({
            langs: [candidate],
            processLocally: true,
            quality: 'dictation',
          });
          if (status !== 'unavailable') {
            if (active) {
              setOfflineLocale(candidate);
              setOfflineStatus(status);
            }
            return;
          }
        } catch {
          continue;
        }
      }
      if (active) setOfflineStatus('unavailable');
    };
    checkLanguagePacks();

    return () => { active = false; };
  }, [locale]);

  useEffect(() => () => recognitionRef.current?.abort(), []);

  const startListening = useCallback((onResult) => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!Recognition) {
      setError('Voice input is not supported in this browser. Continue with the on-screen controls.');
      return;
    }

    const recognition = new Recognition();
    recognition.lang = offlineStatus === 'available' ? offlineLocale : locale;
    recognition.interimResults = false;
    recognition.continuous = false;
    if ('processLocally' in recognition && offlineStatus === 'available') {
      recognition.processLocally = true;
    }
    recognition.onstart = () => {
      setIsListening(true);
      setError('');
    };
    recognition.onresult = (event) => {
      onResult(event.results[0][0].transcript);
    };
    recognition.onerror = (event) => {
      setIsListening(false);
      if (event.error === 'not-allowed' || event.error === 'service-not-allowed') {
        setError('Microphone access is blocked. Allow it in browser settings, or continue with the on-screen controls.');
      } else if (event.error === 'audio-capture') {
        setError('No usable microphone was found. Connect one or continue with the on-screen controls.');
      } else if (event.error === 'network' && offlineStatus === 'downloadable') {
        setError('The online speech service could not connect. Set up on-device speech below, or continue with the on-screen controls.');
      } else if (event.error === 'network') {
        setError('The browser speech service could not connect. Try again later, or continue with the on-screen controls.');
      } else if (event.error === 'no-speech') {
        setError('I did not hear a response. Try again or continue with the on-screen controls.');
      } else {
        setError('Voice input is unavailable right now. Continue with the on-screen controls.');
      }
    };
    recognition.onend = () => setIsListening(false);
    recognitionRef.current = recognition;

    if (!window.isSecureContext && !['localhost', '127.0.0.1'].includes(window.location.hostname)) {
      setError('Microphone access requires a secure page. Open Gramamitra on localhost or HTTPS.');
      return;
    }

    setError('');
    try {
      recognition.start();
    } catch (startError) {
      setError(startError.message || 'Could not start voice input. Continue with the on-screen controls.');
    }
  }, [locale, offlineLocale, offlineStatus]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const installOfflineSpeech = useCallback(async () => {
    const Recognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (typeof Recognition?.install !== 'function') {
      setError('On-device speech setup is not supported in this browser. Continue with the on-screen controls.');
      return;
    }

    setIsInstalling(true);
    setError('');
    try {
      const installed = await Recognition.install({ langs: [offlineLocale], quality: 'dictation' });
      if (!installed) throw new Error('The language pack could not be installed.');
      const status = await Recognition.available({
        langs: [offlineLocale],
        processLocally: true,
        quality: 'dictation',
      });
      setOfflineStatus(status);
      if (status !== 'available') throw new Error('The language pack is not ready for offline speech.');
    } catch (installError) {
      setError(installError.message || 'Could not set up on-device speech. Continue with the on-screen controls.');
    } finally {
      setIsInstalling(false);
    }
  }, [locale, offlineLocale]);

  return {
    error,
    clearError: useCallback(() => setError(''), []),
    isInstalling,
    isListening,
    offlineStatus,
    startListening,
    stopListening,
    installOfflineSpeech,
  };
}
