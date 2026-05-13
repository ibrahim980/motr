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
  ctaHeading?: string;
  ctaDescription?: string;
  primaryCta?: CtaButton;
  secondaryCta?: CtaButton;
  className?: string;
}

const SCENES = [
  {
    shot: '/screenshots/02-dashboard.png',
    alt: 'MOTR dashboard',
    heading: 'صيانة سيارتك بدون حوسة.',
    body: 'كل ما سويت شي بسيارتك صور العداد وحدد العملية، وخل موتر يحسب لك كم باقي على الزيت والكفرات والفلاتر والقطع الاستهلاكية.',
  },
  {
    shot: '/screenshots/03-timeline.png',
    alt: 'MOTR timeline',
    heading: 'سيارتك لها جدول، وموتر يرتبه لك.',
    body: 'كل عملية تنحفظ بتاريخها وعدّادها، فتقدر ترجع لها أي وقت.',
  },
  {
    shot: '/screenshots/05-alerts.png',
    alt: 'MOTR alerts',
    heading: 'البطارية ساكته، بس موتر منتبه.',
    body: 'تنبيهات تجي قبل ما تخرب القطعة — للزيت والبطارية والكفرات.',
  },
  {
    shot: '/screenshots/06-camera.png',
    alt: 'MOTR camera',
    heading: 'صور العداد، وخل الباقي علينا.',
    body: 'كاميرتك تقرأ الرقم تلقائياً — أنت تختار العملية فقط.',
  },
] as const;

export function CinematicLandingHero({
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

  return (
    <section
      ref={rootRef}
      dir="rtl"
      className={cn(
        'motr-cinema-scroll relative isolate overflow-hidden bg-white text-[#0F1115]',
        className,
      )}
    >
      {/* subtle silver wash + brand-orange ambient highlights on white */}
      <div
        className="pointer-events-none absolute inset-0 bg-gradient-to-b from-[#F4F5F7] via-white to-white"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -top-32 -end-32 h-[420px] w-[420px] rounded-full bg-[#F26430]/18 blur-[120px]"
        aria-hidden="true"
      />
      <div
        className="pointer-events-none absolute -bottom-40 -start-32 h-[420px] w-[420px] rounded-full bg-[#FA5306]/14 blur-[120px]"
        aria-hidden="true"
      />

      <div className="motr-cinema-stage relative min-h-[100svh] w-full">
        <div className="grid h-[100svh] w-full grid-cols-1 md:grid-cols-2">
          {/* Phone half — full-bleed visual on its own tinted panel */}
          <div className="relative order-2 flex items-center justify-center overflow-hidden md:order-1">
            <div
              aria-hidden="true"
              className="absolute inset-0 bg-gradient-to-br from-[#F26430]/12 via-transparent to-[#FA5306]/8"
            />

            {/* The phone */}
            <div className="relative z-10 mx-6 my-8 md:scale-110 lg:scale-125">
              <PhoneFrame>
                {SCENES.map((scene, i) => (
                  <img
                    key={scene.shot}
                    src={scene.shot}
                    alt={scene.alt}
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

          {/* Text half — comfortable padding */}
          <div className="relative order-1 flex items-center px-6 pt-10 md:order-2 md:px-12 md:pt-0 lg:px-20">
            <div className="relative w-full">
              <div className="relative min-h-[260px] md:min-h-[360px]">
                {SCENES.map((scene, i) => (
                  <div
                    key={i}
                    className={cn(
                      `motr-text-${i}`,
                      'transition-none',
                      i === 0
                        ? 'relative opacity-100'
                        : 'absolute inset-0 opacity-0',
                    )}
                    style={{ willChange: 'opacity, transform' }}
                  >
                    <h2 className="text-3xl font-bold leading-[1.1] md:text-5xl lg:text-6xl">
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

