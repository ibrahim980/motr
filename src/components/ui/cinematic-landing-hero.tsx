import { useEffect, useRef, type ReactNode } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { cn } from '../../lib/utils';
import { BrandText } from './brand-text';

gsap.registerPlugin(ScrollTrigger);

interface CtaButton {
  label: string;
  href: string;
}

export interface CinematicLandingHeroProps {
  brandName?: string;
  tagline1?: string;
  tagline2?: string;
  cardHeading?: string;
  cardDescription?: string;
  metricValue?: number;
  metricLabel?: string;
  ctaHeading?: string;
  ctaDescription?: string;
  primaryCta?: CtaButton;
  secondaryCta?: CtaButton;
  className?: string;
}

const SCENES = [
  {
    shot: '/screenshots/01-splash.jpeg',
    eyebrow: 'بداية',
    heading: 'Motr',
    body: '',
  },
  {
    shot: '/screenshots/02-dashboard.png',
    eyebrow: 'لوحة المركبة',
    heading: 'صيانة سيارتك بدون حوسة.',
    body: 'كل ما سويت شي بسيارتك صور العداد وحدد العملية، وخل موتر يحسب لك كم باقي على الزيت والكفرات والفلاتر والقطع الاستهلاكية.',
  },
  {
    shot: '/screenshots/03-timeline.png',
    eyebrow: 'سجل كامل',
    heading: 'سيارتك لها جدول، وموتر يرتبه لك.',
    body: 'كل عملية تنحفظ بتاريخها وعدّادها، فتقدر ترجع لها أي وقت.',
  },
  {
    shot: '/screenshots/05-alerts.png',
    eyebrow: 'تنبيهات ذكية',
    heading: 'البطارية ساكته، بس موتر منتبه.',
    body: 'تنبيهات تجي قبل ما تخرب القطعة — للزيت والبطارية والكفرات.',
  },
  {
    shot: '/screenshots/06-camera.png',
    eyebrow: 'صور وانتهيت',
    heading: 'صور العداد، وخل الباقي علينا.',
    body: 'كاميرتك تقرأ الرقم تلقائياً — أنت تختار العملية فقط.',
  },
] as const;

export function CinematicLandingHero({
  brandName = 'Motr',
  tagline1 = 'سيارتك لها عمر،',
  tagline2 = 'وموتر يحسبه عنك.',
  cardHeading = 'صيانة سيارتك بدون حوسة.',
  cardDescription = 'كل ما سويت شي بسيارتك صور العداد وحدد العملية، وخل موتر يحسب لك كم باقي على الزيت والكفرات والفلاتر والقطع الاستهلاكية.',
  metricValue = 82,
  metricLabel = 'باقي على الزيت',
  ctaHeading = 'حافظ على وقتك وفلوسك.',
  ctaDescription = 'موتر يساعدك تعرف متى تغير الزيت والكفرات والفلاتر قبل ما تفاجئك السيارة.',
  primaryCta = { label: 'ابدأ الآن', href: '/app' },
  secondaryCta = { label: 'جرّب موتر', href: '/app' },
  className,
}: CinematicLandingHeroProps) {
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!rootRef.current) return;

    const mm = gsap.matchMedia();

    // Desktop / tablet — pinned scroll-through experience.
    mm.add('(min-width: 768px)', () => {
      const tl = gsap.timeline({
        scrollTrigger: {
          trigger: '.motr-cinema-scroll',
          start: 'top top',
          end: '+=420%',
          scrub: 1,
          pin: '.motr-cinema-stage',
        },
      });

      for (let i = 1; i < SCENES.length; i += 1) {
        const prev = i - 1;
        tl
          .to(`.motr-shot-${prev}`, { opacity: 0, duration: 1, ease: 'power2.inOut' })
          .to(`.motr-shot-${i}`, { opacity: 1, duration: 1, ease: 'power2.inOut' }, '<')
          .to(`.motr-text-${prev}`, { opacity: 0, y: -20, duration: 1, ease: 'power2.inOut' }, '<')
          .to(`.motr-text-${i}`, { opacity: 1, y: 0, duration: 1, ease: 'power2.inOut' }, '<')
          .to({}, { duration: 0.4 });
      }
    });

    // Mobile — light auto-rotation only, no pinning.
    mm.add('(max-width: 767px)', () => {
      let i = 0;
      const id = window.setInterval(() => {
        const next = (i + 1) % SCENES.length;
        gsap.to(`.motr-shot-${i}`, { opacity: 0, duration: 0.6 });
        gsap.to(`.motr-shot-${next}`, { opacity: 1, duration: 0.6 });
        i = next;
      }, 3200);
      return () => window.clearInterval(id);
    });

    return () => mm.revert();
  }, []);

  // SVG ring math
  const ringRadius = 38;
  const ringCircumference = 2 * Math.PI * ringRadius;
  const clamped = Math.max(0, Math.min(100, metricValue));
  const ringOffset = ringCircumference * (1 - clamped / 100);

  return (
    <section
      ref={rootRef}
      dir="rtl"
      className={cn(
        'motr-cinema-scroll relative isolate overflow-hidden bg-[#A6D1E5] text-[#0F1115]',
        className,
      )}
    >
      {/* soft brand-orange ambient lighting */}
      <div
        className="pointer-events-none absolute -top-32 -end-32 h-[420px] w-[420px] rounded-full bg-[#F26430]/25 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -start-32 h-[420px] w-[420px] rounded-full bg-[#FA5306]/20 blur-[120px]"
        aria-hidden="true"
      />

      <div className="motr-cinema-stage relative min-h-[100svh] w-full">
        <div className="mx-auto flex h-[100svh] max-w-6xl items-center px-6 py-12">
          <div className="grid w-full grid-cols-1 items-center gap-10 md:grid-cols-2">
            {/* Text column (scenes stacked) */}
            <div className="relative min-h-[300px] md:min-h-[420px]">
              {/* Always-visible brand line */}
              <p className="mb-4 text-xs font-bold uppercase tracking-[0.3em] text-[#0F1115]/60">
                <BrandText size="1em">{`${brandName} · ${tagline1} ${tagline2}`}</BrandText>
              </p>

              {SCENES.map((scene, i) => (
                <div
                  key={i}
                  className={cn(
                    `motr-text-${i}`,
                    'transition-none',
                    i === 0
                      ? 'relative opacity-100'
                      : 'absolute inset-0 top-12 opacity-0',
                  )}
                  style={{ willChange: 'opacity, transform' }}
                >
                  <span className="inline-block rounded-full bg-[#F26430]/10 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-[#F26430]">
                    {scene.eyebrow}
                  </span>
                  <h2 className="mt-4 text-3xl font-bold leading-[1.15] md:text-5xl">
                    <BrandText>{scene.heading}</BrandText>
                  </h2>
                  {scene.body && (
                    <p className="mt-4 max-w-md text-base leading-relaxed text-[#0F1115]/70 md:text-lg">
                      <BrandText>{scene.body}</BrandText>
                    </p>
                  )}
                </div>
              ))}
            </div>

            {/* Phone column */}
            <div className="flex flex-col items-center gap-6">
              {/* Gradient card behind / beside the phone */}
              <div
                className="relative w-full max-w-md overflow-hidden rounded-[2rem] p-6 text-white shadow-2xl"
                style={{
                  backgroundImage:
                    'linear-gradient(145deg, #F26430 0%, #FA5306 42%, #0F1115 100%)',
                }}
              >
                <div className="flex items-start gap-5">
                  <ProgressRing
                    value={clamped}
                    label={metricLabel}
                    radius={ringRadius}
                    circumference={ringCircumference}
                    offset={ringOffset}
                  />
                  <div className="min-w-0 flex-1">
                    <h3 className="text-base font-bold leading-tight">
                      <BrandText>{cardHeading}</BrandText>
                    </h3>
                    <p className="mt-2 text-xs leading-relaxed text-white/80 line-clamp-4">
                      <BrandText>{cardDescription}</BrandText>
                    </p>
                  </div>
                </div>
              </div>

              {/* iPhone-style mockup with cross-fading shots */}
              <PhoneFrame>
                {SCENES.map((scene, i) => (
                  <img
                    key={scene.shot}
                    src={scene.shot}
                    alt={scene.eyebrow}
                    loading={i === 0 ? 'eager' : 'lazy'}
                    className={cn(
                      `motr-shot-${i}`,
                      'absolute inset-0 h-full w-full object-cover',
                      i === 0 ? 'opacity-100' : 'opacity-0',
                    )}
                    style={{ willChange: 'opacity' }}
                  />
                ))}
              </PhoneFrame>
            </div>
          </div>
        </div>
      </div>

      {/* Final CTA panel — sits below the pinned area */}
      <div className="relative mx-auto max-w-4xl px-6 py-20 text-center">
        <h2 className="text-3xl font-bold leading-tight md:text-5xl">
          <BrandText>{ctaHeading}</BrandText>
        </h2>
        <p className="mx-auto mt-4 max-w-xl text-base leading-relaxed text-[#0F1115]/70 md:text-lg">
          <BrandText>{ctaDescription}</BrandText>
        </p>
        <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
          <a
            href={primaryCta.href}
            className="inline-flex w-full items-center justify-center rounded-full bg-[#F26430] px-8 py-4 font-bold text-white shadow-lg shadow-[#F26430]/30 transition hover:brightness-95 sm:w-auto"
          >
            {primaryCta.label}
          </a>
          <a
            href={secondaryCta.href}
            className="inline-flex w-full items-center justify-center rounded-full border border-[#0F1115]/15 bg-white px-8 py-4 font-bold text-[#0F1115] transition hover:bg-black/5 sm:w-auto"
          >
            {secondaryCta.label}
          </a>
        </div>
      </div>
    </section>
  );
}

function PhoneFrame({ children }: { children: ReactNode }) {
  return (
    <div className="relative w-[230px] rounded-[2.2rem] bg-[#0F1115] p-1.5 shadow-2xl md:w-[260px]">
      <div
        className="relative w-full overflow-hidden rounded-[1.8rem] bg-[#0F1115]"
        style={{ aspectRatio: '9 / 19' }}
      >
        {children}
      </div>
    </div>
  );
}

function ProgressRing({
  value,
  label,
  radius,
  circumference,
  offset,
}: {
  value: number;
  label: string;
  radius: number;
  circumference: number;
  offset: number;
}) {
  const size = (radius + 6) * 2;
  return (
    <div className="relative flex shrink-0 flex-col items-center">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="rgba(255,255,255,0.18)"
          strokeWidth={6}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#FFFFFF"
          strokeWidth={6}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          transform={`rotate(-90 ${size / 2} ${size / 2})`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-xl font-bold leading-none">{value}%</span>
      </div>
      <span className="mt-1 text-[10px] text-white/70">{label}</span>
    </div>
  );
}
