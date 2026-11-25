import { getCitizenComplaintCategoryLabel } from '../utils/complaintCategory';

export const BRAND = {
  name: 'Gramamitra',
  nameDevanagari: 'ग्राममित्र',
  tagline: 'Giving Every Citizen a Voice Through AI.',
  supportingMessage: 'Every Voice Matters.',
  meaning: {
    jan: 'People',
    vani: 'Voice',
  },
  colors: {
    ink: '#1F4736',
    inkDark: '#143426',
    background: '#F7E0C4',
    card: '#FFF8EE',
    saffron: '#F29B38',
    saffronDeep: '#9C4F18',
    chakra: '#2D66B2',
    neutralText: '#25352D',
    neutralMuted: '#58665C',
    success: '#2F6B4F',
    warning: '#8C4F0C',
    error: '#B42318',
    info: '#2D5F91',
  },
  typography: {
    display: '"Playfair Display", "Noto Serif", serif',
    body: '"Inter", "Noto Sans", sans-serif',
  },
  spacing: {
    xs: '0.5rem',
    sm: '1rem',
    md: '1.5rem',
    lg: '2rem',
    xl: '3rem',
  },
  borderRadius: {
    premium: '24px',
    full: '9999px',
  },
  shadows: {
    premium: '0 20px 40px -10px rgba(31, 71, 54, 0.14)',
    saffron: '0 0 30px rgba(242, 155, 56, 0.24)',
    card: '0 4px 20px -4px rgba(37, 53, 45, 0.08)',
  },
  animations: {
    reducedMotion: true,
    duration: {
      fast: '0.2s',
      normal: '0.4s',
      slow: '0.6s',
    },
  },
};

export const SUPPORTED_LANGUAGES = [
  { code: 'en', name: 'English', nativeName: 'English', region: 'Global' },
  { code: 'hi', name: 'Hindi', nativeName: 'हिन्दी', region: 'India' },
  { code: 'kn', name: 'Kannada', nativeName: 'ಕನ್ನಡ', region: 'Karnataka' },
  { code: 'ta', name: 'Tamil', nativeName: 'தமிழ்', region: 'Tamil Nadu' },
  { code: 'te', name: 'Telugu', nativeName: 'తెలుగు', region: 'Andhra Pradesh/Telangana' },
  { code: 'ml', name: 'Malayalam', nativeName: 'മലയാളം', region: 'Kerala' },
  { code: 'mr', name: 'Marathi', nativeName: 'मराठी', region: 'Maharashtra' },
  { code: 'bn', name: 'Bengali', nativeName: 'বাংলা', region: 'West Bengal' },
  { code: 'gu', name: 'Gujarati', nativeName: 'ગુજરાતી', region: 'Gujarat' },
  { code: 'pa', name: 'Punjabi', nativeName: 'ਪੰਜਾਬੀ', region: 'Punjab' },
  { code: 'ur', name: 'Urdu', nativeName: 'اردو', region: 'India/Pakistan' },
  { code: 'or', name: 'Odia', nativeName: 'ଓଡ଼ିଆ', region: 'Odisha' },
];

export const CIVIC_CATEGORIES = [
  { id: 'damaged_footpath', name: getCitizenComplaintCategoryLabel('damaged_footpath'), icon: 'footprints', color: '#9C4F18' },
  { id: 'damaged_road_sign', name: getCitizenComplaintCategoryLabel('damaged_road_sign'), icon: 'signpost', color: '#9C4F18' },
  { id: 'electrical_hazard', name: getCitizenComplaintCategoryLabel('electrical_hazard'), icon: 'zap', color: '#A66B22' },
  { id: 'infrastructure', name: getCitizenComplaintCategoryLabel('infrastructure'), icon: 'building-2', color: '#1F4736' },
  { id: 'normal', name: getCitizenComplaintCategoryLabel('normal'), icon: 'circle-check', color: '#2F6B4F' },
  { id: 'open_manhole_borewell', name: getCitizenComplaintCategoryLabel('open_manhole_borewell'), icon: 'circle-alert', color: '#9C4F18' },
  { id: 'road_damage', name: getCitizenComplaintCategoryLabel('road_damage'), icon: 'road', color: '#9C4F18' },
  { id: 'roadside_garbage', name: getCitizenComplaintCategoryLabel('roadside_garbage'), icon: 'trash-2', color: '#58734A' },
  { id: 'streetlight_faults', name: getCitizenComplaintCategoryLabel('streetlight_faults'), icon: 'lightbulb', color: '#A66B22' },
  { id: 'vegetation', name: getCitizenComplaintCategoryLabel('vegetation'), icon: 'tree-pine', color: '#58734A' },
  { id: 'waterlogging', name: getCitizenComplaintCategoryLabel('waterlogging'), icon: 'droplets', color: '#2D5F91' },
  { id: 'other', name: getCitizenComplaintCategoryLabel('other'), icon: 'more-horizontal', color: '#58665C' },
];

export const MAX_FILE_SIZE_MB = 500;
export const ALLOWED_EXTENSIONS = [
  'jpg', 'jpeg', 'png', 'webp', 'heic',
  'pdf', 'doc', 'docx', 'txt',
  'mp4', 'mov', 'webm',
  'mp3', 'wav', 'm4a',
];

export const REPORTING_STEPS = [
  { id: 'welcome', title: 'Welcome', subtitle: 'Begin your civic report' },
  { id: 'language', title: 'Confirm Language', subtitle: 'Choose your preferred language' },
  { id: 'category', title: 'Select Issue', subtitle: 'What type of civic issue is this?' },
  { id: 'upload', title: 'Upload Evidence', subtitle: 'Add a photograph or document' },
  { id: 'location', title: 'Capture Location', subtitle: 'Where is the issue located?' },
  { id: 'datetime', title: 'Date & Time', subtitle: 'When did you observe this?' },
  { id: 'description', title: 'Describe the Issue', subtitle: 'Tell us about the problem' },
  { id: 'cnn-prediction', title: 'Image Analysis', subtitle: 'AI classification of your evidence' },
  { id: 'prediction-display', title: 'Prediction & Confidence', subtitle: 'Review the AI analysis' },
  { id: 'llm-generation', title: 'Complaint Generation', subtitle: 'AI drafts your formal complaint' },
  { id: 'corrective-action', title: 'Suggested Action', subtitle: 'Recommended corrective steps' },
  { id: 'read-aloud', title: 'Read Aloud', subtitle: 'Hear your complaint before submission' },
  { id: 'citizen-review', title: 'Citizen Review', subtitle: 'Review your complete complaint' },
  { id: 'confirmation', title: 'Confirm Submission', subtitle: 'Explicitly confirm before sending' },
  { id: 'submission', title: 'Submitting', subtitle: 'Your complaint is being filed' },
  { id: 'reference', title: 'Reference Number', subtitle: 'Your complaint reference number' },
];

export const APP_CONFIG = {
  apiBaseUrl: import.meta.env.VITE_API_BASE_URL || 'http://localhost:5000',
  aiBaseUrl: import.meta.env.VITE_AI_BASE_URL || 'http://localhost:8000',
  maxFileSizeMB: MAX_FILE_SIZE_MB,
  chunkSizeMB: 5,
  enableVoice: true,
  enableGPS: true,
  skipIntroForReturningUsers: true,
  introShortDuration: 3000,
  introFullDuration: 8000,
};

export default {
  ...BRAND,
  SUPPORTED_LANGUAGES,
  CIVIC_CATEGORIES,
  MAX_FILE_SIZE_MB,
  ALLOWED_EXTENSIONS,
  REPORTING_STEPS,
  APP_CONFIG,
};
