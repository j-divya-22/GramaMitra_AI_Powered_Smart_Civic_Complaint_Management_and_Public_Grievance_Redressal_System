import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, Globe, LocateFixed, ArrowRight, Check } from 'lucide-react';
import { useTranslation } from 'react-i18next';
import { useLanguage } from '../../context/LanguageContext';
import BilingualText from '../../components/i18n/BilingualText';

export default function LanguageSelection({ onComplete }) {
  const navigate = useNavigate();
  const { t } = useTranslation();
  const { language, setLanguage, supportedLanguages } = useLanguage();
  const [searchQuery, setSearchQuery] = useState('');
  const [gpsRequested, setGpsRequested] = useState(false);
  const [suggestedLanguages, setSuggestedLanguages] = useState([]);
  const [selectedLanguage, setSelectedLanguage] = useState(language);

  useEffect(() => {
    setSelectedLanguage(language);
  }, [language]);

  useEffect(() => {
    if (!gpsRequested) {
      setGpsRequested(true);
      if (navigator.geolocation) {
        navigator.geolocation.getCurrentPosition(
          (pos) => {
            const lat = pos.coords.latitude;
            if (lat >= 6 && lat <= 38 && pos.coords.longitude >= 68 && pos.coords.longitude <= 98) {
              setSuggestedLanguages([
                supportedLanguages.find(l => l.code === 'hi'),
                supportedLanguages.find(l => l.code === 'bn'),
                supportedLanguages.find(l => l.code === 'te'),
                supportedLanguages.find(l => l.code === 'mr'),
                supportedLanguages.find(l => l.code === 'ta'),
              ].filter(Boolean));
            } else {
              setSuggestedLanguages([
                supportedLanguages.find(l => l.code === 'en'),
                supportedLanguages.find(l => l.code === 'es'),
                supportedLanguages.find(l => l.code === 'fr'),
              ].filter(Boolean));
            }
          },
          () => {
            setSuggestedLanguages([
              supportedLanguages.find(l => l.code === 'en'),
              supportedLanguages.find(l => l.code === 'hi'),
            ].filter(Boolean));
          }
        );
      }
    }
  }, [gpsRequested, supportedLanguages]);

  const filteredLanguages = supportedLanguages.filter((lang) =>
    lang.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
    lang.nativeName.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSelect = (code) => {
    setSelectedLanguage(code);
    setLanguage(code);
    localStorage.setItem('janvani_language', code);
  };

  const handleContinue = () => {
    localStorage.setItem('janvani_returning_user', 'true');
    onComplete();
  };

  return (
    <div className="min-h-screen bg-surface-canvas text-neutral-text">
      <nav className="bg-surface-canvas/80 backdrop-blur border-b border-neutral-light sticky top-0 z-20">
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Globe className="w-5 h-5 text-brand-ink" />
            <span className="font-display font-bold text-xl text-brand-ink">Gramamitra</span>
          </div>
          <button
            onClick={() => navigate('/intro')}
            className="text-neutral-muted hover:text-brand-ink transition-colors text-sm"
          >
            <BilingualText english="Back to introduction" />
          </button>
        </div>
      </nav>

      <main className="max-w-2xl mx-auto px-6 py-12">
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center mb-12"
        >
          <h1 className="font-display font-bold text-3xl md:text-4xl text-brand-ink mb-4">
            <BilingualText english="Choose your language" />
          </h1>
          <p className="text-neutral-muted text-lg">
            <BilingualText english="Gramamitra helps you report civic problems using your own language and voice." />
          </p>
        </motion.div>

        <div className="space-y-6">
          {suggestedLanguages.length > 0 && (
            <section className="bg-surface-card rounded-premium p-6 border border-neutral-light shadow-card">
              <h2 className="font-medium text-brand-ink mb-4 flex items-center gap-2">
                <LocateFixed className="w-4 h-4" />
                <BilingualText english="Suggested for your location" />
              </h2>
              <p className="text-neutral-muted text-sm mb-4">
                <BilingualText english="We detected your region. These languages are commonly spoken near you." />
                <span className="text-xs block mt-2 font-normal">
                  <BilingualText english="Location is only a suggestion — you can choose any language." />
                </span>
              </p>
              <div className="flex flex-wrap gap-3">
                {suggestedLanguages.map((lang) => (
                  <button
                    key={lang.code}
                    onClick={() => handleSelect(lang.code)}
                    className={`px-5 py-2.5 rounded-full text-sm font-medium transition-all border ${
                      selectedLanguage === lang.code
                        ? 'bg-brand-ink text-surface-canvas border-brand-ink shadow-saffron'
                        : 'border-neutral-light text-neutral-text hover:bg-neutral-light hover:text-brand-ink'
                    }`}
                  >
                    {lang.nativeName} ({lang.name})
                  </button>
                ))}
              </div>
            </section>
          )}

          <section className="bg-surface-card rounded-premium p-6 border border-neutral-light shadow-card">
            <h2 className="font-medium text-brand-ink mb-4 flex items-center gap-2">
              <Search className="w-4 h-4" />
              <BilingualText english="All languages" />
            </h2>
            <div className="relative mb-4">
              <Search className="absolute left-3 top-3 w-4 h-4 text-neutral-muted" />
              <input
                type="text"
                placeholder={t('Search languages...')}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-10 pr-4 py-3 rounded-xl bg-surface-canvas border border-neutral-light text-neutral-text focus:outline-none focus:ring-2 focus:ring-brand-ink transition-colors"
              />
            </div>
            <div className="space-y-1">
              {filteredLanguages.map((lang) => (
                <button
                  key={lang.code}
                  onClick={() => handleSelect(lang.code)}
                  className="flex items-center justify-between px-4 py-3 rounded-xl bg-surface-canvas border border-neutral-light text-neutral-text hover:bg-brand-ink/5 hover:text-brand-ink transition-colors group"
                >
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{lang.nativeName}</span>
                    <span className="text-sm font-medium">{lang.name}</span>
                    <span className="text-xs text-neutral-muted">{lang.region}</span>
                  </div>
                  {selectedLanguage === lang.code && (
                    <div className="w-5 h-5 rounded-full bg-brand-ink flex items-center justify-center text-surface-canvas text-xs">
                      <Check className="w-3 h-3" />
                    </div>
                  )}
                </button>
              ))}
              {filteredLanguages.length === 0 && (
                <p className="text-neutral-muted text-sm py-4 text-center">
                  <BilingualText english="No languages found matching your search." />
                </p>
              )}
            </div>
          </section>

          <div className="pt-8">
            <p className="text-neutral-muted text-sm text-center mb-6">
              <BilingualText english="Location is used only to suggest languages. It is never used to assume your preference." />
            </p>
            <button
              onClick={handleContinue}
              disabled={!selectedLanguage}
              className={`w-full px-8 py-4 rounded-full font-bold text-lg tracking-widest uppercase transition-all ${
                selectedLanguage
                  ? 'bg-brand-ink text-surface-canvas shadow-saffron hover:scale-[1.02] active:scale-95'
                  : 'bg-neutral-light text-neutral-muted cursor-not-allowed'
              }`}
            >
              <BilingualText english="Continue" /> <ArrowRight className="w-5 h-5 inline-block ml-2" />
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
