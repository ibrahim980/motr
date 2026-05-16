import type { ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bell,
  Camera,
  Car,
  CheckCircle2,
  Clock,
  Droplets,
  Fuel,
  Home as HomeIcon,
  Plus,
  Shield,
  Sparkles,
  User as UserIcon,
  BarChart2,
} from 'lucide-react';
import { useI18n } from './i18n';

type Lang = 'ar' | 'en';

const COPY = {
  ar: {
    nav: { features: 'المميزات', how: 'كيف يعمل', open: 'افتح التطبيق' },
    hero: {
      pill: 'تطبيق ويب · بدون تحميل',
      h1Pre: 'صيانة سيارتك،',
      h1Post: 'ببساطة.',
      sub: 'افتح التطبيق من المتصفح. صوّر العداد بكاميرتك، سجّل الوقود والزيت، واحصل على تنبيهات صيانة ذكية. تسجيل دخول بحساب Google.',
      ctaOpen: 'افتح التطبيق',
      ctaAdd: 'أضِف لسطح المكتب',
      bullets: ['تسجيل دخول بـ Google', 'يعمل بدون تحميل', 'بدون إعلانات'],
    },
    stats: [
      { value: '3s', label: 'لقراءة العداد بالكاميرا' },
      { value: '0 ريال', label: 'لا اشتراك، أبداً' },
    ],
    features: {
      eyebrow: 'المميزات',
      h1Pre: 'كل ما تحتاجه لسيارتك.',
      h1Post: 'في تطبيق واحد.',
      sub: 'صُمّم {logo} للسائق الذي ينسى — أي شخص منا.',
      cards: {
        camera: {
          title: 'صوّر العداد بكاميرتك',
          desc: 'وجّه الكاميرا للعداد، وسيقرأ التطبيق الأرقام تلقائياً. لا إدخال يدوي ولا أخطاء.',
        },
        bell: {
          title: 'تذكيرات صيانة ذكية',
          desc: 'تنبيهات قبل تغيير الزيت، الفلاتر، الإطارات، وأي خدمة تختارها. لن تنسى مرة أخرى.',
        },
        fuel: {
          title: 'تتبّع الوقود والاستهلاك',
          desc: 'احسب معدل استهلاك سيارتك للوقود تلقائياً، تعبئة بعد تعبئة.',
        },
        oil: {
          title: 'الزيت والفلاتر',
          desc: 'سجّل آخر تغيير وتابع المسافة المتبقّية بدقّة. وقت التغيير القادم؟ ستعرفه.',
        },
        history: {
          title: 'تاريخ كامل للسيارة',
          desc: 'كل خدمة، كل تعبئة، كل فاتورة — في مكان واحد منظّم وقابل للبحث.',
        },
        multi: {
          title: 'يدعم عدّة سيارات',
          desc: 'سيارة العائلة، سيارة العمل، سيارة الأبناء — كلها تحت يدك.',
        },
        sync: {
          title: 'مزامنة آمنة مع Google',
          desc: 'سجّل دخولك بحساب Google لتزامن بياناتك بين الجوال واللابتوب. بدون إعلانات، بدون اشتراك.',
        },
      },
    },
    how: {
      eyebrow: 'كيف يعمل',
      h1: 'ثلاث خطوات. خلصت.',
      sub: 'من التنزيل إلى التحكم الكامل في صيانة سيارتك — أقل من دقيقتين.',
      steps: [
        {
          n: '01',
          title: 'افتح التطبيق وسجّل دخول',
          desc: 'افتح {logo} من متصفح جوالك، أو أضِفه لسطح المكتب. سجّل دخول بحساب Google خلال ثوانٍ.',
        },
        {
          n: '02',
          title: 'أضف سيارتك وصوّر العداد',
          desc: 'الموديل والسنة فقط. ثم وجّه الكاميرا على العداد — والباقي علينا.',
        },
        {
          n: '03',
          title: 'تابع كل شيء',
          desc: 'إحصائيات، تذكيرات، وتاريخ مفصّل. متاح على أي جهاز بنفس الحساب.',
        },
      ],
    },
    cta: {
      h1: 'سيارتك تستحق الأفضل.',
      sub: 'افتح التطبيق الآن من المتصفح — تسجيل دخول بـ Google خلال ثوانٍ.',
    },
    footer: {
      tag: 'صنعنا {logo} لأننا، مثلك تماماً، ننسى تغيير الزيت.',
      links: { privacy: 'الخصوصية', terms: 'الشروط', contact: 'اتصل بنا' },
      copy: '© {logo} 2026. جميع الحقوق محفوظة.',
    },
  },
  en: {
    nav: { features: 'Features', how: 'How it works', open: 'Open app' },
    hero: {
      pill: 'Web app · no download',
      h1Pre: 'Your car maintenance,',
      h1Post: 'made simple.',
      sub: 'Open MOTR right from your browser. Scan your odometer with your camera, log fuel and oil changes, and get smart maintenance reminders. Sign in with Google.',
      ctaOpen: 'Open app',
      ctaAdd: 'Add to desktop',
      bullets: ['Sign in with Google', 'Works without install', 'No ads'],
    },
    stats: [
      { value: '3s', label: 'to scan the odometer' },
      { value: '$0', label: 'no subscription, ever' },
    ],
    features: {
      eyebrow: 'Features',
      h1Pre: 'Everything your car needs.',
      h1Post: 'In one app.',
      sub: '{logo} was built for the driver who forgets — that’s all of us.',
      cards: {
        camera: {
          title: 'Scan with your camera',
          desc: 'Point your camera at the odometer and MOTR reads the digits automatically. No typing, no mistakes.',
        },
        bell: {
          title: 'Smart maintenance reminders',
          desc: 'Get pinged before each oil change, filter, tire swap, and any service you set up. Never forget again.',
        },
        fuel: {
          title: 'Fuel and consumption tracking',
          desc: 'MOTR calculates your fuel economy automatically, fill-up after fill-up.',
        },
        oil: {
          title: 'Oil and filters',
          desc: 'Log the last change and follow remaining distance precisely. When is the next change due? You’ll know.',
        },
        history: {
          title: 'Full vehicle history',
          desc: 'Every service, every fill-up, every receipt — in one searchable place.',
        },
        multi: {
          title: 'Multi-vehicle support',
          desc: 'The family car, the work car, the kids’ car — all in one place.',
        },
        sync: {
          title: 'Secure Google sync',
          desc: 'Sign in with Google and your data follows you between phone and laptop. No ads, no subscription.',
        },
      },
    },
    how: {
      eyebrow: 'How it works',
      h1: 'Three steps. Done.',
      sub: 'From install to full control of your car maintenance — under two minutes.',
      steps: [
        {
          n: '01',
          title: 'Open the app and sign in',
          desc: 'Open {logo} in your mobile browser, or add it to your home screen. Sign in with Google in seconds.',
        },
        {
          n: '02',
          title: 'Add your car and scan the odometer',
          desc: 'Just the model and year. Then point the camera at the odometer — we’ll handle the rest.',
        },
        {
          n: '03',
          title: 'Follow everything',
          desc: 'Stats, reminders, and a detailed history. Available on any device with the same account.',
        },
      ],
    },
    cta: {
      h1: 'Your car deserves better.',
      sub: 'Open the app right now from your browser — Google sign-in in seconds.',
    },
    footer: {
      tag: 'We built {logo} because we, just like you, forget to change the oil.',
      links: { privacy: 'Privacy', terms: 'Terms', contact: 'Contact' },
      copy: '© {logo} 2026. All rights reserved.',
    },
  },
} as const;

function useLP() {
  const { lang, setLang } = useI18n();
  const c = COPY[lang as Lang];
  return { lang: lang as Lang, setLang, c };
}

function WithLogo({ text }: { text: string }) {
  const parts = text.split('{logo}');
  return (
    <>
      {parts.map((part, i) => (
        <span key={i}>
          {part}
          {i < parts.length - 1 && (
            <img
              src="/motr2.svg"
              alt="MOTR"
              className="inline-block w-auto align-[-0.6em] mx-1"
              style={{ height: '2em' }}
            />
          )}
        </span>
      ))}
    </>
  );
}

function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-full bg-white/80 border border-[#E1EAF1] px-3 py-1.5 text-xs font-bold text-ink shadow-[0_2px_8px_rgba(14,34,51,0.04)] ${className}`}
    >
      {children}
    </span>
  );
}

function ChevronCta({ children, href, primary = false }: { children: ReactNode; href: string; primary?: boolean }) {
  const { lang } = useLP();
  const Arrow = lang === 'ar' ? ArrowLeft : ArrowRight;
  return (
    <a
      href={href}
      className={
        primary
          ? 'inline-flex items-center gap-2 rounded-full bg-brand text-white px-6 py-3 text-sm font-bold shadow-[0_12px_28px_rgba(242,107,31,0.35)] hover:brightness-95 transition'
          : 'inline-flex items-center gap-2 rounded-full bg-white text-ink border border-[#E1EAF1] px-6 py-3 text-sm font-bold hover:bg-white/90 transition'
      }
    >
      <Arrow className="w-4 h-4" />
      <span>{children}</span>
    </a>
  );
}

function Header() {
  const { lang, setLang, c } = useLP();
  return (
    <header className="sticky top-0 z-30 w-full bg-[#B6CDDB]/80 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-[1280px] items-center justify-between gap-4 px-6">
        <a href="/" className="flex items-center gap-2 shrink-0">
          <img src="/logo.svg" alt="MOTR" className="h-[2.1rem] w-auto" />
        </a>
        <nav className="hidden md:flex items-center gap-6 text-sm font-bold text-ink/80">
          <a href="#features" className="hover:text-ink transition">
            {c.nav.features}
          </a>
          <a href="#how" className="hover:text-ink transition">
            {c.nav.how}
          </a>
        </nav>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setLang(lang === 'ar' ? 'en' : 'ar')}
            className="inline-flex items-center gap-1 rounded-full bg-white border border-[#E1EAF1] px-2 py-1 text-[11px] font-bold text-ink"
            aria-label="Switch language"
          >
            <span className={lang === 'ar' ? 'bg-ink text-white rounded-full px-1.5 py-0.5' : 'px-1.5'}>
              ع
            </span>
            <span className={lang === 'en' ? 'bg-ink text-white rounded-full px-1.5 py-0.5' : 'px-1.5'}>
              EN
            </span>
          </button>
          <a
            href="/app"
            className="rounded-full bg-ink text-white px-4 py-2 text-xs font-bold hover:brightness-110 transition"
          >
            {c.nav.open}
          </a>
        </div>
      </div>
    </header>
  );
}

function HeroPhoneMockup() {
  const { c } = useLP();
  return (
    <div className="relative mx-auto w-[300px] sm:w-[320px]">
      {/* Floating reminder bubble */}
      <div className="absolute -start-6 top-10 z-20 bg-white rounded-2xl px-3 py-2 shadow-[0_12px_28px_rgba(14,34,51,0.18)] flex items-center gap-2 max-w-[200px]">
        <div className="w-7 h-7 rounded-full bg-brand/15 text-brand flex items-center justify-center shrink-0">
          <Bell className="w-3.5 h-3.5" />
        </div>
        <div className="text-end">
          <p className="text-[9px] font-bold text-black/40 uppercase tracking-wide">
            {c.how.eyebrow === 'كيف يعمل' ? 'تذكير' : 'Reminder'}
          </p>
          <p className="text-[11px] font-bold text-ink leading-tight whitespace-nowrap">
            {c.how.eyebrow === 'كيف يعمل' ? 'تغيير زيت بعد 1,200 كم' : 'Oil change in 1,200 km'}
          </p>
        </div>
      </div>

      {/* Floating reading bubble */}
      <div className="absolute -end-4 top-1/2 z-20 bg-white rounded-2xl px-3 py-2 shadow-[0_12px_28px_rgba(14,34,51,0.18)] flex items-center gap-2">
        <div className="w-7 h-7 rounded-lg bg-success/15 text-success flex items-center justify-center shrink-0">
          <Camera className="w-3.5 h-3.5" />
        </div>
        <div>
          <p className="text-[9px] font-bold text-black/40 uppercase tracking-wide">
            {c.how.eyebrow === 'كيف يعمل' ? 'تم القراءة' : 'Captured'}
          </p>
          <p dir="ltr" className="text-[11px] font-bold text-ink tabular">
            212,450 km
          </p>
        </div>
      </div>

      {/* Phone shell — iPhone-ish aspect ratio 9:19.5 */}
      <div className="relative rounded-[44px] bg-[#0E2233] p-2 shadow-[0_40px_80px_-30px_rgba(14,34,51,0.45)] aspect-[9/19.5]">
        <div className="absolute inset-2 rounded-[36px] bg-[#F4F7F9] overflow-hidden flex flex-col">
          {/* status bar */}
          <div className="flex items-center justify-between text-[10px] font-bold text-ink/70 px-5 pt-3">
            <span>9:41</span>
            <div className="h-6 w-20 rounded-full bg-ink" />
            <span dir="ltr">●●● ●</span>
          </div>
          {/* greeting */}
          <div className="text-end px-5 mt-4">
            <p className="text-[10px] text-black/40">سيارتك في حالة ممتازة</p>
            <p className="text-lg font-extrabold text-ink">مرحباً يوسف</p>
          </div>
          {/* dark vehicle card */}
          <div className="rounded-2xl bg-ink text-white p-3.5 mx-4 mt-3">
            <div className="flex items-start justify-between">
              <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold">OK ●</span>
              <div className="text-end">
                <p className="text-[9px] text-white/50">تويوتا كامري</p>
                <p className="text-xs font-bold">2022</p>
              </div>
            </div>
            <div className="mt-3 text-end">
              <p className="text-[9px] text-white/50">العداد الحالي</p>
              <p dir="ltr" className="text-2xl font-extrabold tabular text-end mt-0.5">
                212,450<span className="ms-1 text-[9px] text-white/60">كم</span>
              </p>
            </div>
            <svg viewBox="0 0 200 30" className="mt-1 w-full">
              <path d="M0 22 Q40 4 100 16 T200 8" stroke="#F26B1F" strokeWidth="1.5" fill="none" />
            </svg>
          </div>
          {/* orange cta */}
          <div className="rounded-2xl bg-brand text-white p-3 mx-4 mt-2 flex items-center gap-2">
            <ArrowLeft className="w-3 h-3" />
            <div className="flex-1 text-end">
              <p className="text-[9px] font-bold text-white/85">الصيانة القادمة</p>
              <p className="text-[11px] font-extrabold">تغيير الزيت بعد 1,200 كم</p>
            </div>
            <div className="w-7 h-7 rounded-lg bg-white/15 flex items-center justify-center">
              <Droplets className="w-3.5 h-3.5" />
            </div>
          </div>
          {/* stats */}
          <div className="grid grid-cols-2 gap-2 mx-4 mt-2">
            <div className="rounded-2xl bg-white p-2.5 text-end">
              <p className="text-[8px] font-bold text-black/40">متوسط الوقود</p>
              <p dir="ltr" className="mt-1 text-base font-extrabold tabular text-end">
                8.2<span className="ms-1 text-[8px] text-black/40">لتر/100كم</span>
              </p>
            </div>
            <div className="rounded-2xl bg-white p-2.5 text-end">
              <p className="text-[8px] font-bold text-black/40">آخر تعبئة</p>
              <p className="mt-1 text-base font-extrabold tabular">
                52<span className="ms-1 text-[8px] text-black/40">ريال</span>
              </p>
              <p className="text-[8px] text-black/40 mt-0.5">قبل 4 أيام</p>
            </div>
          </div>
          {/* activities */}
          <div className="mx-4 mt-2 space-y-1.5">
            <div className="rounded-2xl bg-white p-2.5 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-brand/15 text-brand flex items-center justify-center shrink-0">
                <Fuel className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0 text-end">
                <p className="text-[10px] font-bold text-ink truncate">تعبئة وقود</p>
                <p className="text-[8px] text-black/40 truncate">محطة أرامكو · الرياض</p>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-[10px] font-bold">52<span className="ms-0.5 text-[8px] text-black/40">ريال</span></p>
                <p dir="ltr" className="text-[8px] text-black/40 text-end">212,398 كم</p>
              </div>
            </div>
            <div className="rounded-2xl bg-white p-2.5 flex items-center gap-2">
              <div className="w-7 h-7 rounded-lg bg-success/15 text-success flex items-center justify-center shrink-0">
                <CheckCircle2 className="w-3.5 h-3.5" />
              </div>
              <div className="flex-1 min-w-0 text-end">
                <p className="text-[10px] font-bold text-ink truncate">فحص دوري</p>
                <p className="text-[8px] text-black/40 truncate">22 أبر · العداد 208,500 كم</p>
              </div>
              <div className="shrink-0 text-end">
                <p className="text-[10px] font-bold">50<span className="ms-0.5 text-[8px] text-black/40">ريال</span></p>
              </div>
            </div>
          </div>
          {/* spacer pushes nav to the bottom */}
          <div className="flex-1" />
          {/* bottom nav */}
          <div className="px-5 pb-4 pt-2 flex items-center justify-around text-ink/40">
            <HomeIcon className="w-5 h-5 text-brand" />
            <Car className="w-5 h-5" />
            <div className="-mt-5 w-11 h-11 rounded-full bg-brand text-white flex items-center justify-center shadow-[0_8px_18px_rgba(242,107,31,0.38)]">
              <Camera className="w-5 h-5" />
            </div>
            <BarChart2 className="w-5 h-5" />
            <UserIcon className="w-5 h-5" />
          </div>
        </div>
      </div>
    </div>
  );
}

function HeroSection() {
  const { c } = useLP();
  return (
    <section className="mx-auto max-w-[1280px] px-6 pt-10 pb-16">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-12 items-center">
        {/* Phone (right in LTR DOM = left visually in RTL) */}
        <div className="order-1 md:order-2">
          <HeroPhoneMockup />
        </div>
        {/* Text */}
        <div className="order-2 md:order-1 text-center md:text-start">
          <Pill>
            <Sparkles className="w-3 h-3 text-brand" />
            <span>{c.hero.pill}</span>
          </Pill>
          <h1 className="mt-6 text-5xl md:text-6xl lg:text-7xl font-extrabold tracking-tight text-ink leading-[1.05]">
            <span className="block">{c.hero.h1Pre}</span>
            <span className="block">
              {c.hero.h1Post.replace('.', '')}
              <span className="text-brand">.</span>
            </span>
          </h1>
          <p className="mt-5 text-base md:text-lg leading-relaxed text-ink/75 max-w-xl md:me-auto">
            {c.hero.sub}
          </p>
          <div className="mt-7 flex flex-wrap items-center gap-3 md:justify-start justify-center">
            <ChevronCta href="/app" primary>
              {c.hero.ctaOpen}
            </ChevronCta>
          </div>
          <div className="mt-6 flex flex-wrap items-center gap-x-5 gap-y-2 md:justify-start justify-center text-sm text-ink/70 font-medium">
            {c.hero.bullets.map((b) => (
              <span key={b} className="inline-flex items-center gap-1.5">
                <CheckCircle2 className="w-4 h-4 text-success" />
                {b}
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}

function StatsStrip() {
  const { c } = useLP();
  return (
    <section className="bg-white">
      <div className="mx-auto max-w-[1280px] px-6 py-8 grid grid-cols-1 sm:grid-cols-2 gap-6 text-center">
        {c.stats.map((s) => (
          <div key={s.label} className="space-y-1">
            <p className="text-4xl md:text-5xl font-extrabold tracking-tight text-ink tabular">
              {s.value}
            </p>
            <p className="text-xs font-bold text-ink/55">{s.label}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function FeatureCard({
  icon: Icon,
  title,
  desc,
  iconTone = 'soft',
  className = '',
  children,
  dark = false,
}: {
  icon: typeof Camera;
  title: string;
  desc: string;
  iconTone?: 'soft' | 'brand';
  className?: string;
  children?: ReactNode;
  dark?: boolean;
}) {
  const iconBg = dark
    ? 'bg-white/10 text-white'
    : iconTone === 'brand'
      ? 'bg-brand text-white'
      : 'bg-[#DCEAF3] text-ink/80';
  return (
    <div
      className={`rounded-[28px] p-7 ${dark ? 'bg-ink text-white' : 'bg-white text-ink'} shadow-[0_8px_24px_rgba(14,34,51,0.06)] ${className}`}
    >
      <div className="flex items-start gap-4">
        <div className={`w-11 h-11 rounded-xl ${iconBg} flex items-center justify-center shrink-0`}>
          <Icon className="w-5 h-5" />
        </div>
        <div className="flex-1 min-w-0 text-start">
          <h3 className={`text-xl font-extrabold tracking-tight ${dark ? 'text-white' : 'text-ink'}`}>{title}</h3>
          <p className={`mt-2 text-sm leading-relaxed ${dark ? 'text-white/70' : 'text-ink/65'}`}>{desc}</p>
          {children}
        </div>
      </div>
    </div>
  );
}

function FuelMiniChart() {
  return (
    <svg viewBox="0 0 240 60" className="mt-5 w-full">
      <defs>
        <linearGradient id="fg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#F26B1F" stopOpacity="0.18" />
          <stop offset="100%" stopColor="#F26B1F" stopOpacity="0" />
        </linearGradient>
      </defs>
      <path
        d="M0 46 C 30 42, 60 40, 90 38 S 150 32, 180 26 S 220 14, 240 10 L 240 60 L 0 60 Z"
        fill="url(#fg)"
      />
      <path
        d="M0 46 C 30 42, 60 40, 90 38 S 150 32, 180 26 S 220 14, 240 10"
        stroke="#F26B1F"
        strokeWidth="2"
        fill="none"
      />
    </svg>
  );
}

function HistoryMiniTimeline() {
  const { lang } = useLP();
  const rows = lang === 'ar'
    ? [
        { d: '12 مارس', active: true },
        { d: '4 فبراير', active: false },
        { d: '18 ديسمبر', active: false },
      ]
    : [
        { d: 'Mar 12', active: true },
        { d: 'Feb 04', active: false },
        { d: 'Dec 18', active: false },
      ];
  return (
    <ul className="mt-5 space-y-2">
      {rows.map((row) => (
        <li key={row.d} className="flex items-center justify-between text-[11px] font-bold text-ink/55">
          <span className={`inline-block w-2 h-2 rounded-full ${row.active ? 'bg-brand' : 'bg-ink/15'}`} />
          <span>{row.d}</span>
        </li>
      ))}
    </ul>
  );
}

function FeaturesSection() {
  const { c } = useLP();
  const f = c.features.cards;
  return (
    <section id="features" className="mx-auto max-w-[1280px] px-6 py-20">
      <div className="text-start max-w-2xl me-auto">
        <p className="text-sm font-bold text-brand">{c.features.eyebrow}</p>
        <h2 className="mt-3 text-4xl md:text-5xl font-extrabold tracking-tight text-ink leading-tight">
          <span className="block">{c.features.h1Pre}</span>
          <span className="block">{c.features.h1Post}</span>
        </h2>
        <p className="mt-4 text-base text-ink/70 leading-relaxed"><WithLogo text={c.features.sub} /></p>
      </div>

      <div className="mt-12 grid grid-cols-1 md:grid-cols-2 gap-5">
        <FeatureCard icon={Camera} title={f.camera.title} desc={f.camera.desc} iconTone="brand" />
        <FeatureCard icon={Bell} title={f.bell.title} desc={f.bell.desc} />
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-3 gap-5">
        <FeatureCard icon={Fuel} title={f.fuel.title} desc={f.fuel.desc}>
          <FuelMiniChart />
        </FeatureCard>
        <FeatureCard icon={Droplets} title={f.oil.title} desc={f.oil.desc} />
        <FeatureCard icon={Clock} title={f.history.title} desc={f.history.desc}>
          <HistoryMiniTimeline />
        </FeatureCard>
      </div>

      <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-5">
        <FeatureCard icon={Shield} title={f.sync.title} desc={f.sync.desc} dark className="md:col-span-1" />
        <FeatureCard icon={Car} title={f.multi.title} desc={f.multi.desc} />
      </div>
    </section>
  );
}

function StepPhone({ kind }: { kind: 'welcome' | 'capture' | 'vehicles' }) {
  const isDark = kind === 'capture';
  return (
    <div className="relative w-[220px] sm:w-[240px] mx-auto">
      {/* Phone shell with iPhone aspect ratio */}
      <div className="relative rounded-[36px] bg-[#0E2233] p-2 shadow-[0_24px_60px_-24px_rgba(14,34,51,0.45)] aspect-[9/19.5]">
        <div className={`absolute inset-2 rounded-[28px] overflow-hidden flex flex-col ${isDark ? 'bg-[#0E2233]' : 'bg-[#F4F7F9]'}`}>
          {/* status bar */}
          <div className={`flex items-center justify-between text-[9px] font-bold px-4 pt-3 ${isDark ? 'text-white/60' : 'text-ink/70'}`}>
            <span>9:41</span>
            <div className={`h-5 w-16 rounded-full ${isDark ? 'bg-white/10' : 'bg-ink'}`} />
            <span dir="ltr">●● ●</span>
          </div>

          {kind === 'welcome' && (
            <>
              <div className="text-end px-4 mt-3">
                <p className="text-[9px] text-black/40">سيارتك في حالة ممتازة</p>
                <p className="text-base font-extrabold text-ink">مرحباً يوسف</p>
              </div>
              <div className="rounded-2xl bg-ink text-white p-3 mx-3 mt-3">
                <div className="flex items-start justify-between">
                  <span className="rounded-full bg-white/15 px-2 py-0.5 text-[9px] font-bold">OK ●</span>
                  <div className="text-end">
                    <p className="text-[9px] text-white/50">تويوتا كامري</p>
                    <p className="text-xs font-bold">2022</p>
                  </div>
                </div>
                <div className="mt-2 text-end">
                  <p className="text-[9px] text-white/50">العداد الحالي</p>
                  <p dir="ltr" className="text-xl font-extrabold tabular text-end mt-0.5">
                    212,450<span className="ms-1 text-[8px] text-white/60">كم</span>
                  </p>
                </div>
                <svg viewBox="0 0 200 30" className="mt-1 w-full">
                  <path d="M0 22 Q40 4 100 16 T200 8" stroke="#F26B1F" strokeWidth="1.5" fill="none" />
                </svg>
              </div>
              <div className="rounded-2xl bg-brand text-white p-2.5 mx-3 mt-2 flex items-center gap-2">
                <ArrowLeft className="w-3 h-3" />
                <div className="flex-1 text-end">
                  <p className="text-[8px] text-white/85 font-bold">الصيانة القادمة</p>
                  <p className="text-[10px] font-extrabold">تغيير الزيت بعد 1,200 كم</p>
                </div>
                <div className="w-6 h-6 rounded-lg bg-white/15 flex items-center justify-center">
                  <Droplets className="w-3 h-3" />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-1.5 mx-3 mt-2">
                <div className="rounded-xl bg-white p-2 text-end">
                  <p className="text-[8px] font-bold text-black/40">متوسط الوقود</p>
                  <p dir="ltr" className="mt-0.5 text-sm font-extrabold tabular text-end">
                    8.2<span className="ms-0.5 text-[7px] text-black/40">لتر/100كم</span>
                  </p>
                </div>
                <div className="rounded-xl bg-white p-2 text-end">
                  <p className="text-[8px] font-bold text-black/40">آخر تعبئة</p>
                  <p className="mt-0.5 text-sm font-extrabold tabular">
                    52<span className="ms-0.5 text-[7px] text-black/40">ريال</span>
                  </p>
                  <p className="text-[7px] text-black/40">قبل 4 أيام</p>
                </div>
              </div>
              <div className="flex-1" />
              <div className="px-4 pb-3 pt-2 flex items-center justify-around text-ink/40">
                <HomeIcon className="w-4 h-4 text-brand" />
                <Car className="w-4 h-4" />
                <div className="-mt-4 w-9 h-9 rounded-full bg-brand text-white flex items-center justify-center shadow-[0_6px_14px_rgba(242,107,31,0.38)]">
                  <Camera className="w-4 h-4" />
                </div>
                <BarChart2 className="w-4 h-4" />
                <UserIcon className="w-4 h-4" />
              </div>
            </>
          )}

          {kind === 'capture' && (
            <>
              <div className="flex items-center justify-between mt-3 px-4 text-white">
                <button className="w-6 h-6 rounded-full bg-white/10 flex items-center justify-center">
                  <Plus className="w-3 h-3 rotate-45" />
                </button>
                <p className="text-xs font-bold">صوّر العداد</p>
                <span className="w-6" />
              </div>
              <div className="flex-1 mx-3 mt-4 relative rounded-xl border-2 border-dashed border-brand/60 bg-black/30 flex items-center justify-center">
                <div className="absolute inset-3 border-2 border-brand rounded-md" />
                <p dir="ltr" className="text-2xl font-extrabold text-brand tabular tracking-tight">
                  212,450
                </p>
              </div>
              <p className="mt-3 text-center text-[9px] text-white/50">ضع العداد داخل الإطار</p>
              <div className="rounded-xl bg-white p-2 text-end mx-3 mt-3 mb-3">
                <p className="text-[9px] text-black/40">تم التعرّف على</p>
                <p className="text-base font-extrabold tabular">
                  212,450
                  <span className="ms-1 text-[8px] text-black/40">كم</span>
                </p>
              </div>
            </>
          )}

          {kind === 'vehicles' && (
            <>
              <div className="flex items-center justify-between mt-3 px-4">
                <span className="rounded-full bg-success/15 text-success px-2 py-0.5 text-[9px] font-bold">
                  + إضافة سيارة
                </span>
                <p className="text-base font-extrabold text-ink">سياراتي</p>
              </div>
              <div className="mx-3 mt-3 space-y-2">
                {[
                  { name: 'كامري 2022', km: '212,450', sub: 'الخدمة بعد 1,200 كم', tag: 'سياراتي', tone: 'brand' as const },
                  { name: 'هايلكس 2019', km: '156,820', sub: 'الخدمة بعد 4,500 كم', tag: 'العمل', tone: 'success' as const },
                  { name: 'يارس 2018', km: '88,400', sub: 'الفحص بعد 22 يوم', tag: 'الأبناء', tone: 'ink' as const },
                ].map((v) => {
                  const bg = v.tone === 'brand' ? 'bg-[#FFE8D6]' : v.tone === 'success' ? 'bg-[#DBEFD9]' : 'bg-[#DCEAF3]';
                  const chip = v.tone === 'brand' ? 'bg-brand text-white' : v.tone === 'success' ? 'bg-success text-white' : 'bg-ink text-white';
                  const fill = v.tone === 'brand' ? '#F26B1F' : v.tone === 'success' ? '#3F7A40' : '#1F3A52';
                  return (
                    <div key={v.name} className={`rounded-2xl p-3 ${bg}`}>
                      <div className="flex items-start justify-between">
                        <span className={`rounded-full px-2 py-0.5 text-[9px] font-bold ${chip}`}>{v.tag}</span>
                        <svg viewBox="0 0 60 24" className="w-12">
                          <path d="M4 18 Q10 8 22 8 L42 8 Q54 8 56 18 Z" fill={fill} />
                          <circle cx="16" cy="20" r="3" fill="#0E2233" />
                          <circle cx="46" cy="20" r="3" fill="#0E2233" />
                        </svg>
                      </div>
                      <div className="mt-2 text-end">
                        <p className="text-[11px] font-extrabold">{v.name}</p>
                        <p dir="ltr" className="text-[9px] text-ink/50 text-end">{v.km} كم</p>
                        <p className="text-[9px] text-ink/50">{v.sub}</p>
                      </div>
                    </div>
                  );
                })}
              </div>
              <div className="flex-1" />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function HowItWorksSection() {
  const { c } = useLP();
  return (
    <section id="how" className="bg-[#B6CDDB]">
      <div className="mx-auto max-w-[1280px] px-6 py-20">
        <div className="text-start max-w-2xl me-auto">
          <p className="text-sm font-bold text-brand">{c.how.eyebrow}</p>
          <h2 className="mt-3 text-4xl md:text-5xl font-extrabold tracking-tight text-ink leading-tight">
            {c.how.h1}
          </h2>
          <p className="mt-4 text-base text-ink/70 leading-relaxed">{c.how.sub}</p>
        </div>

        <div className="mt-14 grid grid-cols-1 md:grid-cols-3 gap-10">
          {c.how.steps.map((s, i) => {
            const kind = (['vehicles', 'capture', 'welcome'] as const)[i];
            return (
              <div key={s.n} className="text-start space-y-5">
                <div className="rounded-[28px] bg-white p-6 shadow-[0_8px_24px_rgba(14,34,51,0.06)]">
                  <StepPhone kind={kind} />
                </div>
                <div>
                  <p className="text-[11px] font-bold text-ink/40 tracking-wider">{s.n}</p>
                  <h3 className="mt-1 text-xl font-extrabold tracking-tight">{s.title}</h3>
                  <p className="mt-2 text-sm text-ink/65 leading-relaxed"><WithLogo text={s.desc} /></p>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

function BottomCta() {
  const { c } = useLP();
  return (
    <section className="mx-auto max-w-[1280px] px-6 py-16">
      <div className="relative overflow-hidden rounded-[40px] bg-ink text-white px-8 py-16 md:px-16 md:py-20 text-center">
        <div className="absolute inset-x-0 top-1/2 -translate-y-1/2 h-40 bg-brand/25 blur-[120px] pointer-events-none" />
        <h2 className="relative text-4xl md:text-5xl font-extrabold tracking-tight">
          {c.cta.h1.replace('.', '')}
          <span className="text-brand">.</span>
        </h2>
        <p className="relative mt-4 text-sm md:text-base text-white/70 max-w-xl mx-auto">
          {c.cta.sub}
        </p>
        <div className="relative mt-8 flex flex-wrap items-center justify-center gap-3">
          <ChevronCta href="/app" primary>
            {c.hero.ctaOpen}
          </ChevronCta>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  const { c } = useLP();
  return (
    <footer className="bg-[#B6CDDB]">
      <div className="mx-auto max-w-[1280px] px-6 py-10 grid grid-cols-1 md:grid-cols-2 gap-8">
        <div className="text-start">
          <img src="/logo.svg" alt="MOTR" className="h-[2.1rem] w-auto" />
          <p className="mt-3 text-sm text-ink/65 max-w-md"><WithLogo text={c.footer.tag} /></p>
        </div>
        <div className="flex md:items-center md:justify-end gap-6">
          <a href="#" className="text-sm font-bold text-ink/70 hover:text-ink transition">
            {c.footer.links.contact}
          </a>
          <a href="#" className="text-sm font-bold text-ink/70 hover:text-ink transition">
            {c.footer.links.terms}
          </a>
          <a href="#" className="text-sm font-bold text-ink/70 hover:text-ink transition">
            {c.footer.links.privacy}
          </a>
        </div>
      </div>
      <div className="mx-auto max-w-[1280px] px-6 pb-8 text-start text-xs text-ink/50">
        <WithLogo text={c.footer.copy} />
      </div>
    </footer>
  );
}

export function LandingPage() {
  return (
    <div className="min-h-screen bg-[#B6CDDB] text-ink">
      <Header />
      <HeroSection />
      <StatsStrip />
      <FeaturesSection />
      <HowItWorksSection />
      <BottomCta />
      <Footer />
    </div>
  );
}
