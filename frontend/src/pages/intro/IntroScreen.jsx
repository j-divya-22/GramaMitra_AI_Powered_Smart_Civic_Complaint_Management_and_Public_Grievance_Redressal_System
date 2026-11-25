import { useEffect, useState } from 'react';
import { AnimatePresence, motion, useReducedMotion } from 'framer-motion';
import { ArrowLeft, ArrowRight, Pause, Play, Sparkles, X } from 'lucide-react';
import { Link } from 'react-router-dom';
import LoginMenu from '../../components/auth/LoginMenu';
import sloganOne from '../../assets/images/slogans/slogan-01.webp';
import sloganTwo from '../../assets/images/slogans/slogan-02.webp';
import sloganThree from '../../assets/images/slogans/slogan-03.webp';
import sloganFour from '../../assets/images/slogans/slogan-04.webp';
import sloganFive from '../../assets/images/slogans/slogan-05.webp';

const slogans = [
  {
    title: 'Your Village, Our Priority',
    image: sloganOne,
    imageAlt: 'GramaMitra village illustration with the slogan Your Village, Our Priority',
    description: 'Report local concerns so they are visible to the people who can help. GramaMitra supports the journey from identifying a community issue to following its resolution.',
  },
  {
    title: 'A Picture Today, A Better Tomorrow',
    image: sloganTwo,
    imageAlt: 'A phone capturing a civic issue with the slogan A Picture Today, A Better Tomorrow',
    description: 'A clear photo can help explain a local issue and provide useful context. AI-powered reporting tools help organize the details for stronger rural communities.',
  },
  {
    title: 'Smarter Reporting. Cleaner Communities.',
    image: sloganThree,
    imageAlt: 'A hand holding a young plant above a rural landscape',
    description: 'Thoughtful reports help communities understand what needs attention. Working together, residents and local teams can move toward cleaner, healthier neighborhoods.',
  },
  {
    title: 'Real Issues. Smart Solutions.',
    image: sloganFour,
    imageAlt: 'An artificial intelligence and circuit illustration above the slogan Real Issues. Smart Solutions.',
    description: 'Bring real community concerns together with practical, AI-assisted tools. Clear information can help guide useful local responses and improve rural life.',
  },
  {
    title: 'From Rural Voices to Real Change',
    image: sloganFive,
    imageAlt: 'A rural village at sunrise with the slogan From Rural Voices to Real Change',
    description: 'Raise an issue, track its progress, and see updates in one place. Every citizen’s voice can contribute to meaningful improvements in village life.',
  },
];

export default function IntroScreen() {
  const reduceMotion = useReducedMotion();
  const [activeIndex, setActiveIndex] = useState(0);
  const [slideDirection, setSlideDirection] = useState(1);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedSlogan, setSelectedSlogan] = useState(null);
  const activeSlogan = slogans[activeIndex];

  useEffect(() => {
    if (reduceMotion || isPaused || selectedSlogan) return undefined;

    const timer = window.setInterval(() => {
      setSlideDirection(1);
      setActiveIndex((index) => (index + 1) % slogans.length);
    }, 3000);

    return () => window.clearInterval(timer);
  }, [isPaused, reduceMotion, selectedSlogan]);

  useEffect(() => {
    if (!selectedSlogan) return undefined;

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') setSelectedSlogan(null);
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [selectedSlogan]);

  const moveTo = (index, direction) => {
    setSlideDirection(direction);
    setActiveIndex((index + slogans.length) % slogans.length);
  };

  return (
    <main className="min-h-screen bg-[#f4f8f3] text-neutral-text">
      <header className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-6">
        <Link to="/" className="flex items-center gap-3">
          <img src="/assets/images/logo.png" alt="" className="h-12 w-12 object-contain" />
          <span>
            <span className="block font-display text-lg font-bold tracking-tight text-brand-ink">Gramamitra</span>
            <span className="block text-[10px] uppercase tracking-wider text-neutral-muted">ग्राममित्र</span>
          </span>
        </Link>
        <LoginMenu variant="landing" />
      </header>

      <section className="mx-auto max-w-7xl px-4 pb-12 pt-5 sm:px-6 sm:pt-8">
        <div className="mx-auto mb-7 max-w-2xl text-center">
          <p className="inline-flex items-center gap-2 text-xs font-bold uppercase tracking-[0.18em] text-brand-ink-soft">
            <Sparkles className="h-4 w-4" aria-hidden="true" />
            Community voices, stronger villages
          </p>
          <h1 className="mt-3 font-display text-3xl font-bold leading-tight text-brand-ink sm:text-4xl">
            Ideas that move communities forward
          </h1>
          <p className="mt-3 text-sm leading-relaxed text-neutral-muted sm:text-base">
            Explore the GramaMitra vision. Select a slogan to learn more.
          </p>
        </div>

        <div className="mx-auto max-w-5xl overflow-hidden rounded-3xl border border-neutral-light bg-white shadow-premium">
          <div
            role="region"
            aria-roledescription="carousel"
            aria-label="GramaMitra community slogans"
            className="relative"
          >
            <div className="relative h-[310px] overflow-hidden bg-[#f8f7f0] sm:h-[430px] lg:h-[500px]">
              <AnimatePresence initial={false} mode="wait" custom={slideDirection}>
                <motion.button
                  key={activeSlogan.title}
                  type="button"
                  custom={slideDirection}
                  initial={{ opacity: 0, x: reduceMotion ? 0 : slideDirection * 32 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: reduceMotion ? 0 : slideDirection * -32 }}
                  transition={{ duration: reduceMotion ? 0.15 : 0.45, ease: 'easeOut' }}
                  onClick={() => setSelectedSlogan(activeSlogan)}
                  aria-label={`Read more about ${activeSlogan.title}`}
                  className="absolute inset-0 flex h-full w-full items-center justify-center p-3 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-inset focus-visible:ring-brand-ink sm:p-6"
                >
                  <img
                    src={activeSlogan.image}
                    alt={activeSlogan.imageAlt}
                    className="max-h-full max-w-full object-contain"
                    loading={activeIndex === 0 ? 'eager' : 'lazy'}
                    decoding="async"
                  />
                </motion.button>
              </AnimatePresence>
            </div>

            <div className="flex flex-col gap-4 border-t border-neutral-light px-4 py-4 sm:flex-row sm:items-center sm:justify-between sm:px-6">
              <div aria-live="off">
                <h2 className="font-display text-lg font-bold text-brand-ink">{activeSlogan.title}</h2>
                <p className="mt-1 text-xs text-neutral-muted">Select the slide to read its message.</p>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-3 sm:justify-end">
                <div className="flex items-center gap-1.5" aria-label="Choose a slogan">
                  {slogans.map((slogan, index) => (
                    <button
                      key={slogan.title}
                      type="button"
                      onClick={() => moveTo(index, index >= activeIndex ? 1 : -1)}
                      aria-label={`Show slogan ${index + 1}: ${slogan.title}`}
                      aria-current={index === activeIndex ? 'true' : undefined}
                      className={`h-2.5 rounded-full transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2 ${
                        index === activeIndex ? 'w-7 bg-brand-ink' : 'w-2.5 bg-neutral-light hover:bg-brand-ink/40'
                      }`}
                    />
                  ))}
                </div>

                <div className="flex items-center gap-2">
                  {!reduceMotion && (
                    <button
                      type="button"
                      onClick={() => setIsPaused((paused) => !paused)}
                      aria-label={isPaused ? 'Resume automatic slides' : 'Pause automatic slides'}
                      className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-light text-brand-ink transition hover:bg-brand-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink"
                    >
                      {isPaused
                        ? <Play className="h-4 w-4" aria-hidden="true" />
                        : <Pause className="h-4 w-4" aria-hidden="true" />}
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => moveTo(activeIndex - 1, -1)}
                    aria-label="Previous slogan"
                    className="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-light text-brand-ink transition hover:bg-brand-ink/5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink"
                  >
                    <ArrowLeft className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <span className="min-w-12 text-center text-xs font-semibold tabular-nums text-neutral-muted">
                    {activeIndex + 1} / {slogans.length}
                  </span>
                  <button
                    type="button"
                    onClick={() => moveTo(activeIndex + 1, 1)}
                    aria-label="Next slogan"
                    className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-ink text-white transition hover:bg-brand-ink-dark focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink focus-visible:ring-offset-2"
                  >
                    <ArrowRight className="h-4 w-4" aria-hidden="true" />
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      <AnimatePresence>
        {selectedSlogan && (
          <motion.div
            className="fixed inset-0 z-[100] flex items-center justify-center bg-brand-ink/70 p-4 backdrop-blur-sm"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setSelectedSlogan(null)}
          >
            <motion.section
              role="dialog"
              aria-modal="true"
              aria-labelledby="slogan-dialog-title"
              aria-describedby="slogan-dialog-description"
              initial={{ opacity: 0, y: reduceMotion ? 0 : 12, scale: reduceMotion ? 1 : 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: reduceMotion ? 0 : 8, scale: reduceMotion ? 1 : 0.98 }}
              transition={{ duration: reduceMotion ? 0.15 : 0.22 }}
              onClick={(event) => event.stopPropagation()}
              className="relative w-full max-w-lg rounded-3xl bg-surface-card p-6 shadow-premium sm:p-8"
            >
              <button
                type="button"
                onClick={() => setSelectedSlogan(null)}
                aria-label="Close slogan details"
                className="absolute right-4 top-4 flex h-9 w-9 items-center justify-center rounded-full text-neutral-muted transition hover:bg-brand-ink/5 hover:text-brand-ink focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-ink"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
              <p className="text-xs font-bold uppercase tracking-[0.16em] text-brand-ink-soft">Our community promise</p>
              <h2 id="slogan-dialog-title" className="mt-3 pr-8 font-display text-2xl font-bold text-brand-ink">
                {selectedSlogan.title}
              </h2>
              <p id="slogan-dialog-description" className="mt-4 text-sm leading-relaxed text-neutral-muted sm:text-base">
                {selectedSlogan.description}
              </p>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}
