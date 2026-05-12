import { useEffect, useRef, useState } from 'react';
import {
  Bell,
  Brain,
  Camera,
  ChevronDown,
  Menu as MenuIcon,
  Plus,
  Smartphone,
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { QRCodeSVG } from 'qrcode.react';
import { useI18n, type Lang } from './i18n';

const APP_URL = '/app';

const HERO_SCREENSHOTS = [
  '/screenshots/02-dashboard.png',
  '/screenshots/05-alerts.png',
  '/screenshots/06-camera.png',
  '/screenshots/03-timeline.png',
  '/screenshots/04-profile.png',
  '/screenshots/01-splash.jpeg',
];

export function LandingPage() {
  const { t } = useI18n();

  return (
    <div className="min-h-screen bg-bg-dark text-ink">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <img src="/logo.svg" alt="MOTR" className="h-14 w-auto drop-shadow-md" />
        <HeaderMenu />
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-6 pb-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="text-center md:text-start">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.15] mb-6">
              {t('landing.hero_t1')}
              <br />
              <span className="text-brand">{t('landing.hero_t2')}</span>
            </h1>
            <p className="text-lg text-black/60 mb-8 max-w-md mx-auto md:mx-0 leading-relaxed">
              {t('landing.hero_desc')}
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-center md:justify-start mb-6">
              <a
                href={APP_URL}
                className="bg-brand text-white px-8 py-4 rounded-full font-bold inline-flex items-center justify-center gap-2 shadow-lg shadow-brand/30 hover:brightness-95 transition"
              >
                <Plus className="w-5 h-5" />
                {t('landing.start')}
              </a>
              <a
                href="#features"
                className="bg-white border border-black/10 px-8 py-4 rounded-full font-bold inline-flex items-center justify-center gap-2 hover:bg-black/5 transition"
              >
                {t('landing.learn')}
                <ChevronDown className="w-5 h-5" />
              </a>
            </div>

          </div>

          <div className="flex justify-center">
            <RotatingPhoneFrame images={HERO_SCREENSHOTS} />
          </div>
        </div>
      </section>

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

      {/* How it works */}
      <section id="how" className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            {t('landing.how_h')}
          </h2>
          <div className="relative">
            {/* dashed connecting line (desktop) */}
            <div
              className="hidden md:block absolute top-8 left-[16.7%] right-[16.7%] border-t-2 border-dashed border-brand/30"
              aria-hidden="true"
            />
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8 relative max-w-4xl mx-auto">
              <Step n={1} icon={Camera} title={t('landing.s1_t')} desc={t('landing.s1_d')} />
              <Step n={2} icon={Brain} title={t('landing.s2_t')} desc={t('landing.s2_d')} />
              <Step n={3} icon={Bell} title={t('landing.s4_t')} desc={t('landing.s4_d')} />
            </div>
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
    { href: '#how', label: t('landing.how_h') },
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
    <div className="bg-ink rounded-[2.4rem] p-2 shadow-2xl w-full max-w-[280px]">
      <div
        className="relative w-full overflow-hidden rounded-[2rem] bg-bg-dark"
        style={{ aspectRatio: '9 / 19.5' }}
      >
        <AnimatePresence mode="wait">
          <motion.img
            key={images[index]}
            src={images[index]}
            alt=""
            className="absolute inset-0 w-full h-full object-cover"
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

function Step({ n, icon: Icon, title, desc }: { n: number; icon: IconType; title: string; desc: string }) {
  return (
    <div className="text-center">
      <div className="relative w-16 h-16 mx-auto mb-4">
        <div className="absolute inset-0 bg-white border-2 border-brand/30 rounded-full flex items-center justify-center">
          <Icon className="w-7 h-7 text-brand" />
        </div>
        <span className="absolute -bottom-1 -start-1 bg-brand text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-md">
          {n}
        </span>
      </div>
      <h3 className="font-bold mb-2">{title}</h3>
      <p className="text-sm text-black/60 leading-relaxed max-w-[200px] mx-auto">{desc}</p>
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
