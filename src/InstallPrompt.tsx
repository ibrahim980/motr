import { useEffect, useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { X, Share } from 'lucide-react';

const DISMISS_KEY = 'motr-install-dismissed';

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: string[];
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
  prompt(): Promise<void>;
}

function isStandalone(): boolean {
  if (typeof window === 'undefined') return false;
  return (
    window.matchMedia('(display-mode: standalone)').matches ||
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectIOS(): boolean {
  if (typeof window === 'undefined') return false;
  const ua = window.navigator.userAgent;
  return /iPad|iPhone|iPod/.test(ua) && !(window as unknown as { MSStream?: unknown }).MSStream;
}

export function InstallPrompt() {
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [show, setShow] = useState(false);
  const [isIOS, setIsIOS] = useState(false);

  useEffect(() => {
    if (isStandalone()) return;
    if (localStorage.getItem(DISMISS_KEY)) return;

    const iOS = detectIOS();
    setIsIOS(iOS);

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      setShow(true);
    };
    window.addEventListener('beforeinstallprompt', handler);

    let iosTimer: number | undefined;
    if (iOS) {
      iosTimer = window.setTimeout(() => setShow(true), 4000);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      if (iosTimer) window.clearTimeout(iosTimer);
    };
  }, []);

  const dismiss = () => {
    localStorage.setItem(DISMISS_KEY, '1');
    setShow(false);
  };

  const install = async () => {
    if (!deferred) return;
    await deferred.prompt();
    await deferred.userChoice;
    setDeferred(null);
    setShow(false);
    localStorage.setItem(DISMISS_KEY, '1');
  };

  return (
    <AnimatePresence>
      {show && (
        <motion.div
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 260, damping: 24 }}
          className="fixed bottom-28 left-1/2 -translate-x-1/2 z-30 w-[92%] max-w-md px-2"
        >
          <div className="bg-white rounded-2xl shadow-2xl border border-black/10 p-4 flex items-start gap-3 dir-rtl">
            <img src="/icon.svg" alt="" className="w-12 h-12 shrink-0" />
            <div className="flex-1 min-w-0">
              <p className="font-bold text-sm mb-1">أضف MOTR إلى شاشتك الرئيسية</p>
              {isIOS ? (
                <p className="text-xs text-black/60 leading-relaxed">
                  اضغط زر المشاركة
                  <Share className="inline w-3.5 h-3.5 mx-1 -mt-0.5" />
                  ثم اختر <span className="font-medium">"Add to Home Screen"</span>
                </p>
              ) : (
                <button
                  onClick={install}
                  className="mt-1 bg-brand text-white text-xs font-bold uppercase tracking-wider px-4 py-2 rounded-full"
                >
                  ثبّت الآن
                </button>
              )}
            </div>
            <button
              onClick={dismiss}
              className="text-black/40 hover:text-ink shrink-0"
              aria-label="إغلاق"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
