import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Brain,
  Camera,
  Menu as MenuIcon,
  Smartphone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { useI18n, type Lang } from './i18n';
import { CinematicLandingHero } from './components/ui/cinematic-landing-hero';

const APP_URL = '/app';

export function LandingPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-bg-dark text-ink">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <img src="/logo.svg" alt="MOTR" className="h-14 w-auto drop-shadow-md" />
        <HeaderMenu />
      </header>

      {/* Hero (cinematic) */}
      <CinematicLandingHero
        primaryCta={{ label: 'ابدأ الآن', href: APP_URL }}
        secondaryCta={{ label: 'جرّب موتر', href: APP_URL }}
      />

      {/* Features */}
      <section id="features" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            {t('landing.features_h')}
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-4xl mx-auto">
            <FeatureCard icon={Camera} title={t('landing.f1_t')} desc={t('landing.f1_d')} />
            <FeatureCard icon={Brain} title={t('landing.f2_t')} desc={t('landing.f2_d')} />
            <FeatureCard icon={Bell} title={t('landing.f3_t')} desc={t('landing.f3_d')} />
          </div>
        </div>
      </section>

      {/* Why MOTR */}
      <section id="why" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12 flex flex-wrap items-center justify-center gap-3">
            <span>{t('landing.why_prefix')}</span>
            <img src="/motr2.svg" alt="MOTR" className="inline-block h-10 sm:h-12 w-auto align-middle" />
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 max-w-5xl mx-auto">
            {[1, 2, 3, 4, 5, 6].map((n) => (
              <div
                key={n}
                className="bg-white rounded-3xl p-6 border border-black/5 shadow-sm flex gap-4"
              >
                <div className="w-9 h-9 rounded-full bg-brand/10 text-brand font-bold text-sm flex items-center justify-center shrink-0">
                  {n}
                </div>
                <p className="text-sm sm:text-base font-medium leading-relaxed text-ink">
                  {t(`landing.why_${n}`)}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download */}
      <section id="download" className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-black/5">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="text-center md:text-start">
                <h2 className="text-3xl font-bold mb-3">{t('landing.download_h')}</h2>
                <p className="text-black/60 mb-6 leading-relaxed">{t('landing.download_d')}</p>
                <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start">
                  <StoreButton store={t('landing.gplay')} comingSoon={t('landing.coming_soon')} />
                  <StoreButton store={t('landing.appstore')} comingSoon={t('landing.coming_soon')} />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <motion.div
                  className="relative"
                  animate={{ y: [0, -10, 0] }}
                  transition={{ duration: 4.2, repeat: Infinity, ease: 'easeInOut' }}
                >
                  {/* Soft halo */}
                  <div className="absolute inset-0 bg-brand/30 blur-3xl scale-110 rounded-3xl pointer-events-none" />
                  <div className="relative bg-white p-4 rounded-2xl border border-black/10 shadow-2xl shadow-brand/20">
                    <QRCodeSVG
                      value="https://motrs.uk/app"
                      size={180}
                      fgColor="#0F1115"
                      bgColor="#FFFFFF"
                      level="M"
                      imageSettings={{
                        src: '/icon.svg',
                        height: 32,
                        width: 32,
                        excavate: true,
                      }}
                    />
                  </div>
                </motion.div>
                <p className="mt-4 text-xs font-medium text-black/60">{t('landing.scan_label')}</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-8 border-t border-black/5">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-black/50 space-y-2">
          <div className="flex flex-wrap items-center justify-center gap-1">
            <span>{t('landing.rights')}</span>
            <img src="/logo.svg" alt="MOTR" className="inline-block h-5 w-auto align-middle" />
            <span>{t('landing.rights_after')}</span>
          </div>
          <div>
            {t('landing.support_label')}:{' '}
            <a
              href="mailto:support@motrs.uk"
              className="text-brand font-medium hover:underline"
            >
              support@motrs.uk
            </a>
          </div>
        </div>
      </footer>
    </div>
  );
}

function HeaderMenu() {
  const { t, lang, setLang } = useI18n();
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    window.addEventListener('mousedown', onClick);
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('mousedown', onClick);
      window.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const items: Array<{ href: string; label: string }> = [
    { href: APP_URL, label: t('landing.start') },
    { href: '#features', label: t('landing.learn') },
    { href: '#why', label: t('landing.why_short') },
    { href: '#download', label: t('landing.download_h') },
  ];

  const toggleLang = (l: Lang) => {
    setLang(l);
    setOpen(false);
  };

  return (
    <div className="relative" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-12 h-12 rounded-full bg-white border border-black/10 flex items-center justify-center hover:bg-black/5 transition shadow-sm"
        aria-label={t('landing.menu_label')}
        aria-expanded={open}
      >
        <MenuIcon className="w-5 h-5 text-ink" />
      </button>

      {open && (
        <div className="absolute end-0 mt-2 w-56 bg-white rounded-2xl shadow-2xl border border-black/10 p-2 z-30">
          {items.map((it) => (
            <a
              key={it.href}
              href={it.href}
              onClick={() => setOpen(false)}
              className="block px-4 py-2.5 text-sm font-medium rounded-xl hover:bg-black/5 text-end"
            >
              {it.label}
            </a>
          ))}
          <div className="my-1 border-t border-black/10" />
          <div className="flex gap-1 p-1">
            <button
              type="button"
              onClick={() => toggleLang('ar')}
              className={
                'flex-1 py-2 rounded-xl text-xs font-bold transition ' +
                (lang === 'ar' ? 'bg-brand text-white' : 'hover:bg-black/5 text-ink')
              }
            >
              العربية
            </button>
            <button
              type="button"
              onClick={() => toggleLang('en')}
              className={
                'flex-1 py-2 rounded-xl text-xs font-bold transition ' +
                (lang === 'en' ? 'bg-brand text-white' : 'hover:bg-black/5 text-ink')
              }
            >
              English
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function RotatingPhoneFrame({
  images,
  interval = 3500,
}: {
  images: string[];
  interval?: number;
}) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (images.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % images.length);
    }, interval);
    return () => window.clearInterval(id);
  }, [images.length, interval]);

  return (
    <div className="bg-ink rounded-[2.2rem] p-1.5 shadow-2xl w-full max-w-[240px]">
      <div
        className="relative w-full overflow-hidden rounded-[1.8rem] bg-bg-dark"
        style={{ aspectRatio: '9 / 18.5' }}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={images[index]}
            src={images[index]}
            alt=""
            className="absolute inset-0 w-full h-full object-contain"
            initial={{ opacity: 0, scale: 1.03 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.97 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            loading="eager"
          />
        </AnimatePresence>

        {/* dot indicators */}
        <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
          {images.map((_, i) => (
            <span
              key={i}
              className={
                'h-1.5 rounded-full transition-all duration-300 ' +
                (i === index ? 'w-4 bg-brand' : 'w-1.5 bg-white/40')
              }
            />
          ))}
        </div>
      </div>
    </div>
  );
}

type IconType = typeof Camera;

function FeatureCard({ icon: Icon, title, desc }: { icon: IconType; title: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="w-16 h-16 mx-auto mb-4 bg-brand/10 rounded-2xl flex items-center justify-center">
        <Icon className="w-8 h-8 text-brand" />
      </div>
      <h3 className="font-bold text-lg mb-2">{title}</h3>
      <p className="text-sm text-black/60 leading-relaxed">{desc}</p>
    </div>
  );
}

function StoreButton({ store, comingSoon }: { store: string; comingSoon: string }) {
  return (
    <div className="bg-ink text-white px-5 py-3 rounded-2xl flex items-center gap-3">
      <Smartphone className="w-7 h-7 shrink-0" />
      <div className="text-start leading-tight">
        <div className="text-[10px] opacity-70">{comingSoon}</div>
        <div className="font-bold text-sm">{store}</div>
      </div>
    </div>
  );
}
