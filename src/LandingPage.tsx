import {
  Bell,
  BarChart3,
  Brain,
  Camera,
  ChevronDown,
  Plus,
  Smartphone,
  TrendingUp,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';

const APP_URL = '/app';

export function LandingPage() {
  return (
    <div className="min-h-screen bg-bg-dark text-ink">
      {/* Header */}
      <header className="max-w-6xl mx-auto px-6 py-6 flex items-center justify-between">
        <img src="/motr2.svg" alt="MOTR" className="h-14 w-auto drop-shadow-md" />
        <a
          href={APP_URL}
          className="hidden sm:inline-flex items-center gap-2 bg-white border border-black/10 rounded-full px-5 py-2.5 text-sm font-bold hover:bg-black/5 transition"
        >
          فتح التطبيق
        </a>
      </header>

      {/* Hero */}
      <section className="max-w-6xl mx-auto px-6 pt-6 pb-20">
        <div className="grid md:grid-cols-2 gap-10 items-center">
          <div className="order-2 md:order-1 flex justify-center">
            <PhoneFrame src="/screenshots/02-dashboard.png" alt="MOTR dashboard" />
          </div>

          <div className="order-1 md:order-2 text-right">
            <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold leading-[1.15] mb-6">
              صوّر العداد
              <br />
              <span className="text-brand">واترك الباقي علينا</span>
            </h1>
            <p className="text-lg text-black/60 mb-8 max-w-md ms-auto leading-relaxed">
              تطبيق ذكي يراقب حالة سيارتك ويتتبّع الصيانة ويذكّرك بكل ما تحتاجه
              في الوقت المناسب.
            </p>
            <div className="flex flex-col sm:flex-row gap-3 justify-end mb-6">
              <a
                href={APP_URL}
                className="bg-brand text-white px-8 py-4 rounded-full font-bold inline-flex items-center justify-center gap-2 shadow-lg shadow-brand/30 hover:brightness-95 transition"
              >
                <Plus className="w-5 h-5" />
                ابدأ الآن
              </a>
              <a
                href="#features"
                className="bg-white border border-black/10 px-8 py-4 rounded-full font-bold inline-flex items-center justify-center gap-2 hover:bg-black/5 transition"
              >
                تعرف على التطبيق
                <ChevronDown className="w-5 h-5" />
              </a>
            </div>
            <p className="text-sm text-black/60">
              100% مجاني • بدون إعلانات • بياناتك آمنة
            </p>
          </div>
        </div>
      </section>

      {/* Features */}
      <section id="features" className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            ماذا يفعل التطبيق؟
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-6">
            <FeatureCard
              icon={Camera}
              title="تصوير العداد"
              desc="صوّر عداد سيارتك والتطبيق يقرأه تلقائياً بدقة عالية."
            />
            <FeatureCard
              icon={Brain}
              title="ذكاء اصطناعي"
              desc="يحلل بيانات سيارتك ويتنبأ باحتياجات الصيانة قبل حدوثها."
            />
            <FeatureCard
              icon={Bell}
              title="تنبيهات ذكية"
              desc="يذكّرك بالمواعيد المهمة مثل تغيير الزيت والفحص الدوري."
            />
            <FeatureCard
              icon={BarChart3}
              title="تقارير مفهومة"
              desc="اعرف حالة سيارتك بتقارير بسيطة وواضحة في أي وقت."
            />
          </div>
        </div>
      </section>

      {/* How it works */}
      <section className="py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            كيف يعمل؟
          </h2>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
            <Step n={1} icon={Camera} title="صوّر العداد" desc="افتح التطبيق وصوّر عداد السيارة." />
            <Step n={2} icon={Brain} title="تقرأ البيانات" desc="التطبيق يقرأ المسافة بذكاء اصطناعي." />
            <Step n={3} icon={TrendingUp} title="نحلل الحالة" desc="نحلل حالة السيارة ونقدر احتياجات الصيانة." />
            <Step n={4} icon={Bell} title="ننبهك في الوقت المناسب" desc="تصلك تنبيهات ذكية قبل أي مشكلة." />
          </div>
        </div>
      </section>

      {/* Screenshots */}
      <section className="bg-white py-20">
        <div className="max-w-6xl mx-auto px-6">
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-12">
            نظرة على التطبيق
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6">
            {[
              { src: '/screenshots/01-splash.png', label: 'البداية' },
              { src: '/screenshots/02-dashboard.png', label: 'لوحة المعلومات' },
              { src: '/screenshots/03-timeline.png', label: 'سجل المركبة' },
              { src: '/screenshots/04-profile.png', label: 'حسابي' },
            ].map((s) => (
              <div key={s.src} className="flex flex-col items-center">
                <PhoneFrame src={s.src} alt={s.label} small />
                <p className="mt-3 text-sm font-medium text-black/60">{s.label}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Download */}
      <section className="py-20">
        <div className="max-w-4xl mx-auto px-6">
          <div className="bg-white rounded-3xl p-8 md:p-12 shadow-xl border border-black/5">
            <div className="grid md:grid-cols-2 gap-10 items-center">
              <div className="text-right">
                <h2 className="text-3xl font-bold mb-3">حمّل التطبيق الآن</h2>
                <p className="text-black/60 mb-6 leading-relaxed">
                  امسح الباركود لفتح التطبيق وابدأ رحلة العناية الذكية بسيارتك.
                </p>
                <div className="flex flex-col sm:flex-row gap-3 justify-end">
                  <StoreButton store="Google Play" />
                  <StoreButton store="App Store" />
                </div>
              </div>
              <div className="flex flex-col items-center">
                <div className="bg-white p-4 rounded-2xl border border-black/10 shadow-md">
                  <QRCodeSVG
                    value="https://motrs.uk/app"
                    size={180}
                    fgColor="#0F1115"
                    bgColor="#FFFFFF"
                    level="M"
                  />
                </div>
                <p className="mt-3 text-xs font-medium text-black/60">امسح للتحميل</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="bg-white py-8 border-t border-black/5">
        <div className="max-w-6xl mx-auto px-6 text-center text-sm text-black/50">
          © 2025
          <img
            src="/motr2.svg"
            alt="MOTR"
            className="inline-block h-5 w-auto align-middle mx-1"
          />
          . جميع الحقوق محفوظة.
        </div>
      </footer>
    </div>
  );
}

function PhoneFrame({ src, alt, small = false }: { src: string; alt: string; small?: boolean }) {
  return (
    <div
      className={
        small
          ? 'bg-ink rounded-[1.6rem] p-1.5 shadow-xl w-full max-w-[180px]'
          : 'bg-ink rounded-[2.4rem] p-2 shadow-2xl w-full max-w-[280px]'
      }
    >
      <img
        src={src}
        alt={alt}
        className={small ? 'w-full rounded-[1.2rem] block' : 'w-full rounded-[2rem] block'}
        loading="lazy"
      />
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
        <span className="absolute -bottom-1 -right-1 bg-brand text-white text-xs font-bold w-7 h-7 rounded-full flex items-center justify-center shadow-md">
          {n}
        </span>
      </div>
      <h3 className="font-bold mb-2">{title}</h3>
      <p className="text-sm text-black/60 leading-relaxed max-w-[200px] mx-auto">{desc}</p>
    </div>
  );
}

function StoreButton({ store }: { store: string }) {
  return (
    <div className="bg-ink text-white px-5 py-3 rounded-2xl flex items-center gap-3">
      <Smartphone className="w-7 h-7 shrink-0" />
      <div className="text-right leading-tight">
        <div className="text-[10px] opacity-70">قريباً</div>
        <div className="font-bold text-sm">{store}</div>
      </div>
    </div>
  );
}
