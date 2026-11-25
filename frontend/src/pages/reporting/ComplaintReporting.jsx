import { Suspense, lazy, useCallback, useEffect, useRef, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import {
  ArrowLeft, ArrowRight, CheckCircle2, ImagePlus, Loader2, LocateFixed,
  MapPin, Search, X,
} from 'lucide-react';
import { useLanguage } from '../../context/LanguageContext';
import { useAuth } from '../../context/AuthContext';
import { CIVIC_CATEGORIES } from '../../config/brand';
import { COMPLAINT_CATEGORY_IMAGES } from '../../config/complaintCategoryImages';
import BilingualText from '../../components/i18n/BilingualText';
import { aiAPI, complaintAPI, uploadAPI } from '../../services/api';
import { createLocalComplaint } from '../../services/localComplaints';
import { prepareEvidenceImage } from '../../services/evidence';
import { isLocalDemoMode } from '../../config/authMode';
import { getCitizenComplaintCategoryLabel, summarizeImagePredictions } from '../../utils/complaintCategory';
import {
  findCategoryFromSpeech,
  getSpeechLocale,
  getVoiceGuide,
  isContinueRequest,
  isGpsRequest,
  isLocationConfirmation,
  isReportSubmissionConfirmation,
} from '../../services/voiceGuide';
import useVoiceInput from '../../hooks/useVoiceInput';
import VoiceCoach from '../../components/voice/VoiceCoach';

const STEPS = [
  { title: 'Choose an issue', subtitle: 'Choose a category if you know it, or let your photo identify the issue.' },
  { title: 'Add the details', subtitle: 'Describe what happened and attach helpful photos.' },
  { title: 'Pin the location', subtitle: 'Choose the exact place on the map or use GPS.' },
  { title: 'Review your report', subtitle: 'Everything look right? You can edit any step.' },
];

const STATUS_COPY = 'Your report has been received and is waiting for staff review.';
const LocationMap = lazy(() => import('../../components/report/LocationMap'));

export default function ComplaintReporting() {
  const navigate = useNavigate();
  const location = useLocation();
  const { language } = useLanguage();
  const { user } = useAuth();
  const voiceInput = useVoiceInput(language);
  const [voiceGuided, setVoiceGuided] = useState(location.state?.voiceGuided === true);
  const [voiceStatus, setVoiceStatus] = useState('');
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [voiceEnabled, setVoiceEnabled] = useState(true);
  const lastSpokenStep = useRef(-1);
  const [currentStep, setCurrentStep] = useState(0);
  const [direction, setDirection] = useState(1);
  const [formData, setFormData] = useState({
    category: '',
    description: '',
    location_address: '',
    latitude: null,
    longitude: null,
  });
  const [manualCategory, setManualCategory] = useState('');
  const [evidence, setEvidence] = useState([]);
  const [locationConfirmed, setLocationConfirmed] = useState(false);
  const [locationError, setLocationError] = useState('');
  const [error, setError] = useState('');
  const [isPreparingImages, setIsPreparingImages] = useState(false);
  const [isClassifying, setIsClassifying] = useState(false);
  const [imagePredictions, setImagePredictions] = useState([]);
  const [isLocating, setIsLocating] = useState(false);
  const [addressResults, setAddressResults] = useState([]);
  const [isGeocodingAddress, setIsGeocodingAddress] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submittedComplaint, setSubmittedComplaint] = useState(null);
  const [englishDescription, setEnglishDescription] = useState('');
  const [isTranslating, setIsTranslating] = useState(false);
  const [translationError, setTranslationError] = useState('');
  const [translationAttempt, setTranslationAttempt] = useState(0);
  const translationRequest = useRef(0);
  const voiceGuide = getVoiceGuide(language);
  const voicePrompt = currentStep === 3
    ? `${voiceGuide.steps[3]} ${getCitizenComplaintCategoryLabel(formData.category)}. ${formData.description}. ${formData.location_address}.`
    : voiceGuide.steps[currentStep];

  const speak = useCallback((text) => {
    if (!('speechSynthesis' in window) || typeof window.SpeechSynthesisUtterance !== 'function') {
      setVoiceStatus('Spoken guidance is unavailable in this browser. You can continue using the on-screen controls.');
      return;
    }

    window.speechSynthesis.cancel();
    const utterance = new window.SpeechSynthesisUtterance(text);
    utterance.lang = getSpeechLocale(language);
    const voice = window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase() === utterance.lang.toLowerCase())
      || window.speechSynthesis.getVoices().find((item) => item.lang.toLowerCase().startsWith(language));
    if (voice) utterance.voice = voice;
    utterance.onstart = () => {
      setIsSpeaking(true);
      setVoiceStatus('');
    };
    utterance.onend = () => setIsSpeaking(false);
    utterance.onerror = (event) => {
      setIsSpeaking(false);
      if (event.error === 'canceled' || event.error === 'interrupted') return;
      setVoiceStatus('Spoken guidance could not play. Continue with the on-screen instructions.');
    };
    window.speechSynthesis.speak(utterance);
  }, [language]);

  useEffect(() => {
    if (!voiceEnabled || !voiceGuided || submittedComplaint) return undefined;
    if (lastSpokenStep.current === currentStep) return undefined;
    lastSpokenStep.current = currentStep;
    setVoiceStatus('');
    const timer = window.setTimeout(() => speak(voicePrompt), 400);
    return () => {
      window.clearTimeout(timer);
      window.speechSynthesis?.cancel();
    };
  }, [speak, submittedComplaint, voiceEnabled, voiceGuided, voicePrompt]);

  useEffect(() => () => window.speechSynthesis?.cancel(), []);

  useEffect(() => {
    if (currentStep !== 3) return undefined;

    const originalDescription = formData.description.trim();
    const requestId = ++translationRequest.current;
    if (!originalDescription) {
      setEnglishDescription('');
      setTranslationError('');
      setIsTranslating(false);
      return undefined;
    }

    if (language === 'en') {
      setEnglishDescription(originalDescription);
      setTranslationError('');
      setIsTranslating(false);
      return undefined;
    }

    setEnglishDescription('');
    setTranslationError('');
    setIsTranslating(true);
    aiAPI.translateToEnglish({ text: originalDescription, source_language: language })
      .then(({ data }) => {
        if (requestId !== translationRequest.current) return;
        if (typeof data.translated_text !== 'string' || !data.translated_text.trim()) {
          throw new Error('The translation service returned an empty translation.');
        }
        setEnglishDescription(data.translated_text.trim());
      })
      .catch((translationRequestError) => {
        if (requestId !== translationRequest.current) return;
        setTranslationError(
          translationRequestError.response?.data?.error
          || 'English translation is unavailable. Check that the Gramamitra AI service and language model are running, then retry.'
        );
      })
      .finally(() => {
        if (requestId === translationRequest.current) setIsTranslating(false);
      });

    return () => {
      translationRequest.current += 1;
    };
  }, [currentStep, formData.description, language, translationAttempt]);

  const updateFormData = (updates) => {
    setFormData((current) => ({ ...current, ...updates }));
    setError('');
    voiceInput.clearError();
  };

  const selectCoordinates = ({ latitude, longitude }) => {
    setFormData((current) => ({
      ...current,
      latitude,
      longitude,
      location_address: current.location_address.trim()
        ? current.location_address
        : `Map pin (${latitude.toFixed(5)}, ${longitude.toFixed(5)})`,
    }));
    setAddressResults([]);
    setLocationConfirmed(false);
    setLocationError('');
    setError('');
    voiceInput.clearError();
  };

  const handleLocateMe = (confirmAndAdvance = false) => {
    setLocationError('');
    if (!navigator.geolocation) {
      setLocationError('GPS location is not available in this browser. You can pin the map or enter the location manually.');
      return;
    }

    setIsLocating(true);
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        selectCoordinates({ latitude: coords.latitude, longitude: coords.longitude });
        if (confirmAndAdvance) {
          setLocationConfirmed(true);
          setVoiceStatus('Your location was selected. Opening the report review.');
          setDirection(1);
          setCurrentStep(3);
        }
        setIsLocating(false);
      },
      (geoError) => {
        const message = geoError.code === geoError.PERMISSION_DENIED
          ? 'Location permission was not granted. Pin the map or enter the location manually.'
          : 'Could not detect your location. Pin the map or enter it manually.';
        setLocationError(message);
        setIsLocating(false);
      },
      { enableHighAccuracy: true, timeout: 12000, maximumAge: 30000 }
    );
  };

  const handleAddressSearch = async () => {
    const address = formData.location_address.trim();
    if (address.length < 3) {
      setLocationError('Enter at least 3 characters to search for an address.');
      return;
    }
    setIsGeocodingAddress(true);
    setLocationError('');
    setAddressResults([]);
    try {
      const { data } = await complaintAPI.geocodeAddress(address);
      if (data.status === 'not_found') {
        setLocationError('No matching address was found. You can adjust the address or place a map pin instead.');
        return;
      }
      if (data.status === 'provider_unavailable') {
        setLocationError('Address search is temporarily unavailable. Your typed address is retained and you can pin the map manually.');
        return;
      }
      if (!Array.isArray(data.results) || data.results.length === 0) {
        setLocationError('No reliable address result was returned. Please use the map pin.');
        return;
      }
      setAddressResults(data.results);
    } catch (searchError) {
      setLocationError(
        searchError.response?.data?.error
        || 'Address search is temporarily unavailable. Your typed address is retained and you can pin the map manually.'
      );
    } finally {
      setIsGeocodingAddress(false);
    }
  };

  const selectAddressResult = (result) => {
    const latitude = Number(result.latitude);
    const longitude = Number(result.longitude);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)
      || latitude < -90 || latitude > 90
      || longitude < -180 || longitude > 180) {
      setLocationError('The address result did not contain valid coordinates. Please choose another result or pin the map.');
      return;
    }
    setFormData((current) => ({
      ...current,
      latitude,
      longitude,
      location_address: result.displayName || current.location_address,
    }));
    setAddressResults([]);
    setLocationConfirmed(false);
    setLocationError('');
  };

  const handleEvidenceSelected = async (event) => {
    const selectedFiles = Array.from(event.target.files || []);
    event.target.value = '';
    if (evidence.length + selectedFiles.length > 4) {
      setError('You can attach up to 4 photos to one report.');
      return;
    }

    setIsPreparingImages(true);
    setError('');
    try {
      const prepared = [];
      for (const file of selectedFiles) {
        prepared.push(await prepareEvidenceImage(file));
      }
      setEvidence((current) => [...current, ...prepared]);
      setImagePredictions([]);
    } catch (imageError) {
      setError(imageError.message || 'Unable to prepare the selected photo.');
    } finally {
      setIsPreparingImages(false);
    }
  };

  const handleNext = async () => {
    if (isClassifying) return;
    setError('');
    if (currentStep === 1 && !formData.description.trim()) {
      setError('Add a short description to continue.');
      return;
    }
    if (currentStep === 2 && (!formData.location_address.trim() || !locationConfirmed)) {
      setError('Choose or enter a location, then confirm it to continue.');
      return;
    }
    if (currentStep === 2 && evidence.length > 0 && !isLocalDemoMode) {
      setIsClassifying(true);
      try {
        const results = await Promise.all(evidence.map(async (image) => {
          const file = new File([image.blob], image.name, { type: image.type });
          try {
            const { data } = await aiAPI.classifyImage(file);
            return data;
          } catch (classificationError) {
            const status = classificationError.response?.status;
            if (status && status < 500) throw classificationError;
            return {
              prediction: 'needs_review',
              confidence: null,
              model: 'cnn-unavailable',
              needs_review: true,
              review_reason: 'classification_unavailable',
            };
          }
        }));
        setImagePredictions(results);
      } catch (classificationError) {
        setError(
          classificationError.response?.data?.error
          || classificationError.message
          || 'Image classification is unavailable. Try again before reviewing your report.'
        );
        return;
      } finally {
        setIsClassifying(false);
      }
    }
    if (currentStep === 0) setManualCategory(formData.category);
    if (currentStep === 2 && evidence.length === 0 && manualCategory) {
      setFormData((current) => ({ ...current, category: manualCategory }));
      setImagePredictions([]);
    }
    setDirection(1);
    setCurrentStep((step) => Math.min(step + 1, STEPS.length - 1));
  };

  const advanceToStep = (step) => {
    setError('');
    setDirection(step >= currentStep ? 1 : -1);
    setCurrentStep(step);
  };

  const handlePrevious = () => {
    setError('');
    setDirection(-1);
    setCurrentStep((step) => Math.max(step - 1, 0));
  };

  const handleSubmit = async () => {
    if (!formData.category && (isLocalDemoMode || evidence.length === 0)) {
      setError('Choose an issue category, or attach a photo so the CNN can identify it.');
      setCurrentStep(0);
      return;
    }
    if (!locationConfirmed) {
      setError('Confirm the issue location before submitting.');
      setCurrentStep(2);
      return;
    }

    const originalDescription = formData.description.trim();
    const modelDescription = language === 'en' ? originalDescription : englishDescription.trim();
    if (!modelDescription) {
      setError('Wait for the English translation to finish before submitting this report.');
      return;
    }

    setError('');
    setSubmitting(true);
    try {
      if (isLocalDemoMode) {
        const complaint = createLocalComplaint({
          citizenId: user.id,
          citizenName: user.name,
          category: formData.category,
          description: originalDescription,
          englishDescription: modelDescription,
          locationAddress: formData.location_address.trim(),
          latitude: formData.latitude,
          longitude: formData.longitude,
          evidenceFiles: evidence.map((image) => ({
            filename: image.name,
            originalname: image.name,
            mimetype: image.type,
            size: image.size,
            url: image.previewUrl,
          })),
        });
        setSubmittedComplaint(complaint);
      } else {
        const uploadedEvidence = evidence.length
          ? await uploadAPI.uploadMultiple(
            evidence.map((image) => new File([image.blob], image.name, { type: image.type }))
          )
          : { data: { files: [] } };

        const { data } = await complaintAPI.create({
          ...formData,
          category: formData.category || undefined,
          description: modelDescription,
          original_complaint: originalDescription,
          language,
          location_confirmed: locationConfirmed,
          evidence_files: uploadedEvidence.data.files,
        });
        setSubmittedComplaint(data.complaint);
      }
    } catch (requestError) {
      setError(requestError.response?.data?.error || requestError.message || 'Unable to save your report. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleVoiceAnswer = (transcript) => {
    const spokenText = transcript.trim();
    if (!spokenText) return;
    voiceInput.clearError();
    setVoiceStatus(`I heard: “${spokenText}”.`);

    if (currentStep === 0) {
      if (isContinueRequest(spokenText, language)) {
        setManualCategory(formData.category);
        advanceToStep(1);
        return;
      }
      const categoryId = findCategoryFromSpeech(spokenText, language);
      const category = CIVIC_CATEGORIES.find((item) => item.id === categoryId);
      if (!category) {
        setVoiceStatus(voiceGuide.steps[0]);
        speak(voiceGuide.steps[0]);
        return;
      }
      setManualCategory(category.id);
      updateFormData({ category: category.id });
      setVoiceStatus(`${category.name} selected.`);
      advanceToStep(1);
      return;
    }

    if (currentStep === 1) {
      if (isContinueRequest(spokenText, language)) {
        handleNext();
        return;
      }
      updateFormData({ description: spokenText });
      setVoiceStatus(voiceGuide.steps[1]);
      speak(voiceGuide.steps[1]);
      return;
    }

    if (currentStep === 2) {
      if (isGpsRequest(spokenText, language)) {
        setVoiceStatus('You asked me to use GPS. Your browser may ask for location permission.');
        handleLocateMe(true);
        return;
      }
      if (isLocationConfirmation(spokenText, language)) {
        if (!formData.location_address.trim() && formData.latitude === null) {
          setVoiceStatus(voiceGuide.steps[2]);
          speak(voiceGuide.steps[2]);
          return;
        }
        setLocationConfirmed(true);
        setVoiceStatus('Location confirmed. Opening the report review.');
        advanceToStep(3);
        return;
      }
      updateFormData({ location_address: spokenText });
      setLocationConfirmed(false);
      setVoiceStatus(voiceGuide.steps[2]);
      speak(voiceGuide.steps[2]);
      return;
    }

    if (currentStep === 3) {
      if (isReportSubmissionConfirmation(spokenText, language)) {
        setVoiceStatus('Submitting your confirmed report.');
        handleSubmit();
      } else {
        setVoiceStatus(voiceGuide.steps[3]);
        speak(voicePrompt);
      }
    }
  };

  const handleVoiceListen = () => {
    lastSpokenStep.current = currentStep;
    setVoiceGuided(true);
    setVoiceStatus('');
    voiceInput.clearError();
    voiceInput.startListening(handleVoiceAnswer);
  };

  const toggleVoice = () => {
    if (voiceEnabled) {
      window.speechSynthesis?.cancel();
      setIsSpeaking(false);
      setVoiceEnabled(false);
      return;
    }

    lastSpokenStep.current = currentStep;
    setVoiceGuided(true);
    setVoiceEnabled(true);
    setVoiceStatus('');
    speak(voicePrompt);
  };

  if (submittedComplaint) {
    const complaintId = submittedComplaint.id;
    const reference = submittedComplaint.referenceNumber || submittedComplaint.reference_number;
    return (
      <div className="min-h-[70vh] bg-surface-canvas px-4 py-12 sm:px-6">
        <motion.section
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          className="mx-auto max-w-xl rounded-3xl border border-neutral-light bg-surface-card p-8 text-center shadow-premium sm:p-12"
        >
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-success/10 text-success">
            <CheckCircle2 className="h-8 w-8" aria-hidden="true" />
          </div>
          <p className="mb-2 text-sm font-semibold uppercase tracking-[0.16em] text-success">Report received</p>
          <h1 className="font-display text-3xl font-bold text-brand-ink">Your voice is on its way.</h1>
          <p className="mt-3 text-neutral-muted">{STATUS_COPY}</p>
          <div className="mt-7 rounded-2xl bg-surface-canvas p-5">
            <p className="text-xs font-semibold uppercase tracking-wider text-neutral-muted">Reference number</p>
            <p className="mt-2 font-mono text-lg font-bold text-brand-ink">{reference}</p>
          </div>
          {isLocalDemoMode && (
            <p className="mt-4 rounded-xl bg-saffron-light/40 px-4 py-3 text-sm text-neutral-text">
              Local prototype: this report and its photos are saved only in this browser.
            </p>
          )}
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to={`/complaints/${complaintId}`} className="btn-primary !px-6 !py-3 !text-sm">
              Track this report
            </Link>
            <button type="button" onClick={() => navigate('/dashboard')} className="btn-secondary !px-6 !py-3 !text-sm">
              Back to dashboard
            </button>
          </div>
        </motion.section>
      </div>
    );
  }

  const step = STEPS[currentStep];
  const imagePredictionSummary = summarizeImagePredictions(imagePredictions);

  return (
    <div className="min-h-screen bg-surface-canvas text-neutral-text">
      <main className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:py-12">
        <div className="mb-8 flex flex-wrap items-center justify-between gap-4">
          <button
            type="button"
            onClick={() => navigate('/dashboard')}
            className="inline-flex items-center gap-2 rounded-full px-3 py-2 text-sm font-semibold text-neutral-muted transition hover:bg-neutral-light hover:text-brand-ink"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" /> Dashboard
          </button>
          <div className="text-right">
            <p className="text-sm font-bold text-brand-ink">New community report</p>
            <p className="text-xs text-neutral-muted">A few simple steps</p>
          </div>
        </div>

        <div className="mb-8">
          <VoiceCoach
            language={language}
            prompt={voicePrompt}
            status={voiceInput.error || voiceStatus}
            isSpeaking={isSpeaking}
            isListening={voiceInput.isListening}
            isInstalling={voiceInput.isInstalling}
            offlineStatus={voiceInput.offlineStatus}
            voiceEnabled={voiceEnabled}
            onToggleVoice={toggleVoice}
            onListen={handleVoiceListen}
            onInstallOffline={voiceInput.installOfflineSpeech}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-[270px_minmax(0,1fr)] lg:gap-8">
          <aside className="h-fit rounded-3xl border border-neutral-light bg-surface-card p-5 shadow-card lg:sticky lg:top-24">
            <div className="mb-5">
              <div className="mb-2 flex items-center justify-between text-xs font-semibold text-neutral-muted">
                <span><BilingualText english="REPORT PROGRESS" /></span>
                <span>{currentStep + 1} / {STEPS.length}</span>
              </div>
              <div
                role="progressbar"
                aria-label={language === 'en' ? 'Report progress' : 'Track your report'}
                aria-valuemin={1}
                aria-valuemax={STEPS.length}
                aria-valuenow={currentStep + 1}
                className="h-2 overflow-hidden rounded-full bg-neutral-light"
              >
                <motion.div
                  className="h-full rounded-full bg-saffron-muted"
                  animate={{ width: `${((currentStep + 1) / STEPS.length) * 100}%` }}
                  transition={{ duration: 0.35 }}
                />
              </div>
            </div>
            <ol className="grid grid-cols-2 gap-2 lg:grid-cols-1">
              {STEPS.map((item, index) => (
                <li key={item.title}>
                  <button
                    type="button"
                    onClick={() => {
                      if (index < currentStep) {
                        setDirection(-1);
                        setCurrentStep(index);
                      }
                    }}
                    disabled={index >= currentStep}
                    className={`flex w-full items-center gap-3 rounded-2xl px-3 py-3 text-left transition ${
                      index === currentStep ? 'bg-brand-ink text-white shadow-card' : 'text-neutral-muted'
                    }`}
                  >
                    <span className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
                      index === currentStep ? 'bg-saffron text-brand-ink' : index < currentStep ? 'bg-success/10 text-success' : 'bg-neutral-light'
                    }`}>
                      {index < currentStep ? <CheckCircle2 className="h-4 w-4" aria-hidden="true" /> : index + 1}
                    </span>
                    <span className="text-sm font-semibold leading-tight"><BilingualText english={item.title} /></span>
                  </button>
                </li>
              ))}
            </ol>
            <p className="mt-5 hidden rounded-2xl bg-brand-ink/5 p-4 text-xs leading-relaxed text-neutral-muted lg:block">
              Share only what helps the response team understand and locate the issue.
            </p>
          </aside>

          <section className="min-w-0 overflow-hidden rounded-3xl border border-neutral-light bg-surface-card shadow-card">
            <div className="border-b border-neutral-light px-5 py-6 sm:px-8 sm:py-7">
              <p className="text-xs font-bold uppercase tracking-[0.18em] text-saffron-muted">
                <BilingualText english="Step {{number}}" values={{ number: currentStep + 1 }} />
              </p>
              <h1 className="mt-2 font-display text-2xl font-bold text-brand-ink sm:text-3xl">
                <BilingualText english={step.title} />
              </h1>
              <p className="mt-2 text-sm text-neutral-muted sm:text-base"><BilingualText english={step.subtitle} /></p>
            </div>

            {error && <p role="alert" className="mx-5 mt-5 rounded-xl border border-error/20 bg-error/5 p-4 text-sm text-error sm:mx-8">{error}</p>}

            <div className="px-5 py-6 sm:px-8 sm:py-8">
              <AnimatePresence mode="wait" initial={false}>
                <motion.div
                  key={currentStep}
                  initial={{ opacity: 0, x: direction * 24 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: direction * -18 }}
                  transition={{ duration: 0.22, ease: 'easeOut' }}
                >
                  {currentStep === 0 && (
                    <div>
                      <p className="mb-4 text-sm text-neutral-muted">
                        <BilingualText english="Choose a category if you know it; your choice becomes the complaint title. Photo analysis is shown separately." />
                      </p>
                      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {CIVIC_CATEGORIES.filter((category) => category.id !== 'normal').map((category) => (
                          <button
                            key={category.id}
                            type="button"
                            aria-pressed={formData.category === category.id}
                            onClick={() => {
                              setManualCategory(category.id);
                              updateFormData({ category: category.id });
                            }}
                            className={`group flex min-h-28 w-full items-center gap-3 rounded-2xl border p-3 text-left transition-all duration-200 hover:-translate-y-0.5 hover:shadow-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 sm:p-4 ${
                              formData.category === category.id
                                ? 'border-brand-ink bg-brand-ink/5 text-brand-ink shadow-card ring-2 ring-brand-ink/20'
                                : 'border-neutral-light bg-white/70 text-neutral-text hover:border-brand-ink/50'
                            }`}
                          >
                            <span className="min-w-0 flex-1">
                              <span className="block break-words font-semibold leading-snug">
                                <BilingualText english={category.name} />
                              </span>
                              <span className={`mt-1 block text-xs ${formData.category === category.id ? 'text-brand-ink/70' : 'text-neutral-muted'}`}>
                                <BilingualText english={formData.category === category.id ? 'Selected' : 'Select this category'} />
                              </span>
                            </span>
                            <img
                              src={COMPLAINT_CATEGORY_IMAGES[category.id].src}
                              alt={COMPLAINT_CATEGORY_IMAGES[category.id].alt}
                              loading="lazy"
                              decoding="async"
                              className="h-20 w-24 shrink-0 rounded-xl object-cover sm:w-28"
                            />
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {currentStep === 1 && (
                    <div className="space-y-7">
                      <div>
                        <label htmlFor="complaint-description" className="mb-2 block text-sm font-bold text-neutral-text">
                          Describe the issue
                        </label>
                        <textarea
                          id="complaint-description"
                          value={formData.description}
                          onChange={(event) => updateFormData({ description: event.target.value })}
                          rows={5}
                          maxLength={5000}
                          placeholder="What happened? When did you notice it? Add details that could help resolve the issue."
                          className="w-full rounded-2xl border border-neutral-light bg-white px-4 py-3 text-neutral-text outline-none transition focus:border-brand-ink focus:ring-4 focus:ring-brand-ink/10"
                        />
                        <p className="mt-2 text-right text-xs text-neutral-muted">{formData.description.length}/5000</p>
                      </div>

                      <div>
                        <div className="mb-3">
                          <h2 className="text-sm font-bold text-neutral-text">Photo evidence <span className="font-normal text-neutral-muted">(optional)</span></h2>
                          <p className="mt-1 text-xs text-neutral-muted">Up to 4 JPG, PNG, or WebP photos. Images are resized for this prototype.</p>
                        </div>
                        <label className="flex cursor-pointer flex-col items-center justify-center rounded-2xl border border-dashed border-brand-ink/30 bg-brand-ink/[0.03] px-5 py-7 text-center transition hover:border-brand-ink/70 hover:bg-brand-ink/[0.06]">
                          <span className="mb-3 flex h-11 w-11 items-center justify-center rounded-full bg-brand-ink/10 text-brand-ink">
                            {isPreparingImages ? <Loader2 className="h-5 w-5 animate-spin" /> : <ImagePlus className="h-5 w-5" />}
                          </span>
                          <span className="text-sm font-semibold text-brand-ink">{isPreparingImages ? 'Preparing photos…' : 'Choose photos'}</span>
                          <span className="mt-1 text-xs text-neutral-muted">Select from your device</span>
                          <input
                            type="file"
                            accept="image/jpeg,image/png,image/webp"
                            multiple
                            disabled={isPreparingImages || evidence.length >= 4}
                            onChange={handleEvidenceSelected}
                            className="sr-only"
                          />
                        </label>
                        {evidence.length > 0 && (
                          <ul className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
                            {evidence.map((image) => (
                              <li key={image.id} className="group relative overflow-hidden rounded-xl border border-neutral-light bg-white">
                                <img src={image.previewUrl} alt={`Evidence: ${image.name}`} className="aspect-square w-full object-cover" />
                                <button
                                  type="button"
                                  onClick={() => {
                                    setEvidence((current) => current.filter((item) => item.id !== image.id));
                                    setImagePredictions([]);
                                  }}
                                  className="absolute right-2 top-2 rounded-full bg-brand-ink-dark/80 p-1.5 text-white opacity-100 transition hover:bg-error sm:opacity-0 sm:group-hover:opacity-100"
                                  aria-label={`Remove ${image.name}`}
                                >
                                  <X className="h-4 w-4" aria-hidden="true" />
                                </button>
                                <p className="truncate px-2 py-1.5 text-xs text-neutral-muted">{image.name}</p>
                              </li>
                            ))}
                          </ul>
                        )}
                      </div>
                    </div>
                  )}

                  {currentStep === 2 && (
                    <div className="space-y-5">
                      <div className="flex flex-wrap items-start justify-between gap-3">
                        <div>
                          <h2 className="text-sm font-bold text-neutral-text">Choose or enter the issue location</h2>
                          <p className="mt-1 text-xs text-neutral-muted">Use GPS, search an address, or tap the map to place a pin.</p>
                        </div>
                        <button
                          type="button"
                          onClick={handleLocateMe}
                          disabled={isLocating}
                          className="inline-flex items-center gap-2 rounded-full border border-brand-ink/20 bg-white px-4 py-2 text-xs font-bold text-brand-ink transition hover:bg-brand-ink/5 disabled:opacity-60"
                        >
                          {isLocating ? <Loader2 className="h-4 w-4 animate-spin" /> : <LocateFixed className="h-4 w-4" />}
                          {isLocating ? 'Locating…' : 'Use my GPS'}
                        </button>
                      </div>
                      <Suspense fallback={<div role="status" className="flex h-80 items-center justify-center rounded-2xl bg-neutral-light text-sm text-neutral-muted">Loading map…</div>}>
                        <LocationMap
                          position={formData.latitude === null ? null : {
                            latitude: formData.latitude,
                            longitude: formData.longitude,
                          }}
                          onSelect={selectCoordinates}
                        />
                      </Suspense>
                      {formData.latitude !== null && (
                        <p role="status" className="flex items-center gap-2 text-xs font-medium text-success">
                          <MapPin className="h-4 w-4" aria-hidden="true" />
                          Pin selected: {formData.latitude.toFixed(5)}, {formData.longitude.toFixed(5)}
                        </p>
                      )}
                      {locationError && <p role="status" className="rounded-xl bg-warning/5 p-3 text-xs text-warning">{locationError}</p>}
                      <div>
                        <label htmlFor="complaint-location" className="mb-2 block text-sm font-bold text-neutral-text">
                          Address or nearby landmark
                        </label>
                        <div className="flex flex-col gap-2 sm:flex-row">
                          <input
                            id="complaint-location"
                            value={formData.location_address}
                            onChange={(event) => {
                              updateFormData({ location_address: event.target.value, latitude: null, longitude: null });
                              setAddressResults([]);
                              setLocationConfirmed(false);
                            }}
                            onKeyDown={(event) => {
                              if (event.key === 'Enter') {
                                event.preventDefault();
                                handleAddressSearch();
                              }
                            }}
                            maxLength={500}
                            placeholder="Street, landmark, ward, or locality"
                            className="min-w-0 flex-1 rounded-2xl border border-neutral-light bg-white px-4 py-3 text-sm text-neutral-text outline-none transition focus:border-brand-ink focus:ring-4 focus:ring-brand-ink/10"
                          />
                          <button
                            type="button"
                            onClick={handleAddressSearch}
                            disabled={isGeocodingAddress || formData.location_address.trim().length < 3}
                            className="inline-flex shrink-0 items-center justify-center gap-2 rounded-2xl bg-brand-ink px-4 py-3 text-sm font-bold text-white transition hover:bg-brand-ink-dark disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            {isGeocodingAddress ? <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> : <Search className="h-4 w-4" aria-hidden="true" />}
                            {isGeocodingAddress ? 'Searching…' : 'Search address'}
                          </button>
                        </div>
                        {addressResults.length > 0 && (
                          <div className="mt-3 space-y-2 rounded-2xl border border-neutral-light bg-white p-3">
                            <p className="text-xs font-semibold text-neutral-text">Choose the matching location</p>
                            {addressResults.map((result) => (
                              <button
                                key={result.id}
                                type="button"
                                onClick={() => selectAddressResult(result)}
                                className="flex w-full items-start gap-2 rounded-xl px-3 py-2 text-left text-xs text-neutral-text transition hover:bg-brand-ink/5"
                              >
                                <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-brand-ink" aria-hidden="true" />
                                <span>{result.displayName}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                      <label className="flex cursor-pointer items-start gap-3 rounded-2xl bg-brand-ink/[0.04] p-4 text-sm text-neutral-text">
                        <input
                          type="checkbox"
                          checked={locationConfirmed}
                          onChange={(event) => setLocationConfirmed(event.target.checked)}
                          className="mt-0.5 h-4 w-4 accent-brand-ink"
                        />
                        <span>I confirm this pin or address is where the civic issue occurred.</span>
                      </label>
                      <p className="text-xs leading-relaxed text-neutral-muted">
                        GPS is requested only when you tap the button; Gramamitra does not continuously track your location. Map tiles are provided by OpenStreetMap.
                      </p>
                    </div>
                  )}

                  {currentStep === 3 && (
                    <section aria-label="Report summary" className="space-y-5">
                      <div className="rounded-2xl bg-white p-5">
                        <p className="text-xs font-bold uppercase tracking-wider text-neutral-muted">Issue</p>
                        <p className="mt-2 font-semibold text-neutral-text">{getCitizenComplaintCategoryLabel(formData.category)}</p>
                        {imagePredictions.length > 0 && (
                          <div className={`mt-4 rounded-xl p-4 text-sm ${imagePredictionSummary.needsReview ? 'border border-warning/20 bg-saffron-light/30 text-neutral-text' : 'border border-success/20 bg-success/5 text-neutral-text'}`}>
                            <p className="font-semibold">
                              {imagePredictionSummary.needsReview
                                ? 'CNN result needs staff verification'
                                : 'CNN category identified'}
                            </p>
                            <ul className="mt-2 space-y-1 text-xs">
                              {imagePredictions.map((prediction, index) => (
                                <li key={`${prediction.model}-${index}`}>
                                  Photo {index + 1}:{' '}
                                  {prediction.review_reason === 'classification_unavailable'
                                    ? 'Needs review (CNN unavailable)'
                                    : getCitizenComplaintCategoryLabel(prediction.prediction)}
                                </li>
                              ))}
                            </ul>
                            {imagePredictionSummary.needsReview && (
                              <p className="mt-2 text-xs">
                                {imagePredictions.some((prediction) => prediction.review_reason === 'classification_unavailable')
                                  ? 'One or more photos could not be classified and will be sent for staff review.'
                                  : 'This prediction will be sent for staff review rather than treated as a final complaint category.'}
                              </p>
                            )}
                          </div>
                        )}
                        {isTranslating && (
                          <p role="status" className="mt-2 flex items-center gap-2 text-sm text-neutral-muted">
                            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" /> Translating your report…
                          </p>
                        )}
                        {!isTranslating && translationError && (
                          <div className="mt-2">
                            <p role="alert" className="text-sm text-error">{translationError}</p>
                            <button
                              type="button"
                              onClick={() => setTranslationAttempt((attempt) => attempt + 1)}
                              className="mt-3 rounded-full border border-brand-ink/20 px-4 py-2 text-xs font-bold text-brand-ink transition hover:bg-brand-ink/5"
                            >
                              Retry translation
                            </button>
                          </div>
                        )}
                        {!isTranslating && !translationError && (
                          <div className="mt-3 space-y-3">
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-muted">Original complaint</p>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-text">{formData.description}</p>
                            </div>
                            <div>
                              <p className="text-[11px] font-bold uppercase tracking-wider text-neutral-muted">English description</p>
                              <p className="mt-1 whitespace-pre-wrap text-sm leading-relaxed text-neutral-text">{englishDescription}</p>
                            </div>
                          </div>
                        )}
                      </div>
                      <div className="rounded-2xl bg-white p-5">
                        <p className="text-xs font-bold uppercase tracking-wider text-neutral-muted">Location</p>
                        <p className="mt-2 flex items-center gap-2 font-semibold text-neutral-text">
                          <MapPin className="h-4 w-4 text-brand-ink" aria-hidden="true" /> {formData.location_address}
                        </p>
                        {formData.latitude !== null && (
                          <p className="mt-1 text-xs text-neutral-muted">{formData.latitude.toFixed(5)}, {formData.longitude.toFixed(5)}</p>
                        )}
                      </div>
                      {evidence.length > 0 && (
                        <div className="rounded-2xl bg-white p-5">
                          <p className="mb-3 text-xs font-bold uppercase tracking-wider text-neutral-muted">Attached photos · {evidence.length}</p>
                          <div className="flex flex-wrap gap-3">
                            {evidence.map((image) => (
                              <img key={image.id} src={image.previewUrl} alt={`Evidence: ${image.name}`} className="h-20 w-20 rounded-xl object-cover" />
                            ))}
                          </div>
                        </div>
                      )}
                      <div className="rounded-2xl border border-saffron-muted/30 bg-saffron-light/25 p-4 text-sm leading-relaxed text-neutral-text">
                        {isLocalDemoMode
                          ? 'Prototype mode: this report, photo evidence, progress updates, and messages stay in this browser.'
                          : 'Your report and photo evidence will be sent securely to the configured Gramamitra backend.'}
                      </div>
                    </section>
                  )}
                </motion.div>
              </AnimatePresence>

              <div className="mt-8 flex flex-wrap items-center justify-between gap-3 border-t border-neutral-light pt-6">
                <button
                  type="button"
                  onClick={handlePrevious}
                  disabled={currentStep === 0 || submitting}
                  className="rounded-full px-5 py-3 text-sm font-semibold text-neutral-muted transition hover:bg-neutral-light hover:text-brand-ink disabled:invisible"
                >
                  Back
                </button>
                {currentStep < STEPS.length - 1 ? (
                  <button type="button" onClick={handleNext} disabled={isClassifying} className="btn-primary !px-6 !py-3 !text-sm disabled:cursor-not-allowed disabled:opacity-60">
                    {isClassifying ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden="true" />Analyzing photos…</> : <>Continue <ArrowRight className="ml-1 inline h-4 w-4" aria-hidden="true" /></>}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={handleSubmit}
                    disabled={submitting || isTranslating || !englishDescription || Boolean(translationError)}
                    className="btn-primary !px-6 !py-3 !text-sm disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    {submitting && <Loader2 className="mr-2 inline h-4 w-4 animate-spin" aria-hidden="true" />}
                    {submitting ? 'Saving report…' : isLocalDemoMode ? 'Save demo report' : 'Submit report'}
                  </button>
                )}
              </div>
            </div>
          </section>
        </div>
      </main>
    </div>
  );
}
