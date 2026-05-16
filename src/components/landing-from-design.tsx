// Direction A — "Spacious & Soft"
// White paper, lots of breathing room, warm cream sections, brand orange used precisely.

function DirectionA() {
  const { t, lang } = useLang();
  const dir = lang === 'ar' ? 'rtl' : 'ltr';
  const isAr = lang === 'ar';

  return (
    <div dir={dir} style={{
      background: 'var(--paper)', minHeight: '100vh',
      fontFamily: isAr ? 'var(--font-ar)' : 'var(--font-sans)',
    }}>
      <ANavBar />
      <AHero />
      <AStats />
      <AFeatures />
      <AHowItWorks />
      <AFinalCTA />
      <AFooter />
    </div>
  );
}

// ─── Nav ───────────────────────────────────────────────────────
function ANavBar() {
  const { t } = useLang();
  return (
    <header style={{
      position: 'sticky', top: 0, zIndex: 100,
      background: 'rgba(251, 248, 244, 0.85)',
      backdropFilter: 'blur(14px) saturate(180%)',
      WebkitBackdropFilter: 'blur(14px) saturate(180%)',
      borderBottom: '1px solid rgba(232, 226, 216, 0.6)',
    }}>
      <div style={{
        maxWidth: 1240, margin: '0 auto',
        padding: '14px 32px',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <Wordmark/>
        <nav style={{ display: 'flex', alignItems: 'center', gap: 28, fontSize: 14, fontWeight: 500, color: 'var(--ink-2)' }}>
          <a href="#features">{t.nav.features}</a>
          <a href="#how">{t.nav.how}</a>
          <LangToggle/>
          <a href="#download" style={{
            padding: '9px 18px', borderRadius: 999,
            background: 'var(--ink)', color: 'white', fontSize: 13, fontWeight: 600,
          }}>{t.nav.download}</a>
        </nav>
      </div>
    </header>
  );
}

function Wordmark() {
  return (
    <div style={{ display: 'flex', alignItems: 'center' }} dir="ltr">
      <MotrsLogo size={26}/>
    </div>
  );
}

// ─── Hero ──────────────────────────────────────────────────────
function AHero() {
  const { t, lang } = useLang();
  const isAr = lang === 'ar';

  return (
    <section style={{ position: 'relative', overflow: 'hidden' }}>
      <div style={{
        maxWidth: 1240, margin: '0 auto',
        padding: '72px 32px 40px',
        display: 'grid', gridTemplateColumns: '1.1fr 0.9fr',
        gap: 64, alignItems: 'center',
      }}>
        <div>
          {/* Eyebrow */}
          <div style={{
            display: 'inline-flex', alignItems: 'center', gap: 10,
            padding: '7px 14px 7px 10px', borderRadius: 999,
            background: 'white', border: '1px solid var(--line)',
            fontSize: 12, fontWeight: 600, color: 'var(--ink-2)',
            letterSpacing: '0.04em',
            boxShadow: 'var(--shadow-sm)',
          }}>
            <span style={{
              width: 22, height: 22, borderRadius: 99,
              background: 'var(--brand)', color: 'white',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
            }}>
              <Icon name="spark" size={13} stroke={2.2}/>
            </span>
            <span>{t.hero.eyebrow}</span>
          </div>

          <h1 style={{
            margin: '24px 0 20px',
            fontSize: 'clamp(46px, 6.5vw, 84px)',
            lineHeight: 0.98,
            letterSpacing: isAr ? '-0.02em' : '-0.035em',
            fontWeight: 700,
            color: 'var(--ink)',
            textWrap: 'balance',
          }}>
            <span style={{ display: 'block' }}>{t.hero.title[0]}</span>
            <span style={{ display: 'block', color: 'var(--brand)' }}>{t.hero.title[1]}</span>
          </h1>

          <p style={{
            fontSize: 18, lineHeight: 1.55,
            color: 'var(--ink-2)', maxWidth: 520,
            margin: '0 0 32px',
            textWrap: 'pretty',
          }}>{t.hero.sub}</p>

          {/* CTAs */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <StoreButton kind="apple" label={t.hero.cta1}/>
            <StoreButton kind="play" label={t.hero.cta2}/>
          </div>

          {/* Trust bits */}
          <div style={{
            marginTop: 28,
            display: 'flex', alignItems: 'center', gap: 18,
            fontSize: 13, color: 'var(--ink-3)', flexWrap: 'wrap',
          }}>
            {t.hero.badgeBits.map((b, i) => (
              <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
                <Icon name="check" size={14} stroke={2.3} color="var(--brand)"/>
                <span>{b}</span>
              </span>
            ))}
          </div>
        </div>

        {/* Phone */}
        <div style={{ position: 'relative', display: 'flex', justifyContent: 'center', alignItems: 'center', minHeight: 720 }}>
          {/* Soft halo */}
          <div style={{
            position: 'absolute', width: 520, height: 520, borderRadius: '50%',
            background: 'radial-gradient(closest-side, rgba(250, 83, 6, 0.15), rgba(250, 83, 6, 0) 70%)',
            filter: 'blur(20px)',
          }}/>
          <div style={{
            transform: 'rotate(-3deg)',
            filter: 'drop-shadow(0 60px 80px rgba(26, 24, 20, 0.18))',
            position: 'relative',
          }}>
            <IOSDevice width={332} height={720}>
              <PhoneDashboard brand="var(--brand)" />
            </IOSDevice>
          </div>

          {/* Floating chips */}
          <FloatingChip
            style={{ top: 30, [isAr ? 'left' : 'right']: -10 }}
            icon="bell" iconColor="var(--brand)" iconBg="#FFF1E5"
            title={isAr ? 'تذكير' : 'Reminder'}
            sub={isAr ? 'تغيير زيت بعد 1,200 كم' : 'Oil change in 1,200 km'}
          />
          <FloatingChip
            style={{ bottom: 140, [isAr ? 'right' : 'left']: -10 }}
            icon="ocr" iconColor="#3F7A40" iconBg="#EDF4ED"
            title={isAr ? 'تم القراءة' : 'Scanned'}
            sub="212,450 km"
            mono
          />
        </div>
      </div>
    </section>
  );
}

function FloatingChip({ style, icon, iconColor, iconBg, title, sub, mono }) {
  const { lang } = useLang();
  return (
    <div style={{
      position: 'absolute',
      background: 'white',
      borderRadius: 16,
      padding: '11px 14px',
      boxShadow: 'var(--shadow-md)',
      display: 'flex', alignItems: 'center', gap: 11,
      minWidth: 200,
      direction: lang === 'ar' ? 'rtl' : 'ltr',
      ...style,
    }}>
      <div style={{
        width: 34, height: 34, borderRadius: 10,
        background: iconBg, color: iconColor,
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        flexShrink: 0,
      }}>
        <Icon name={icon} size={18} stroke={2}/>
      </div>
      <div>
        <div style={{ fontSize: 10.5, fontWeight: 600, color: 'var(--ink-3)', letterSpacing: '0.06em', textTransform: 'uppercase' }}>{title}</div>
        <div className={mono ? 'tabular' : ''} style={{ fontSize: 13.5, fontWeight: 600, color: 'var(--ink)', marginTop: 1, direction: mono ? 'ltr' : 'inherit' }}>{sub}</div>
      </div>
    </div>
  );
}

function StoreButton({ kind, label }) {
  const Inner = (
    <>
      <Icon name={kind === 'apple' ? 'apple' : 'play'} size={22} color="white"/>
      <span style={{ fontSize: 14.5, fontWeight: 600, lineHeight: 1.15, textAlign: 'left', whiteSpace: 'nowrap' }}>{label}</span>
    </>
  );
  return (
    <a href="#" style={{
      display: 'inline-flex', alignItems: 'center', gap: 10,
      padding: '12px 20px', borderRadius: 14,
      background: 'var(--ink)', color: 'white',
      direction: 'ltr', whiteSpace: 'nowrap',
    }}>
      {Inner}
    </a>
  );
}

// ─── Stats strip ──────────────────────────────────────────────
function AStats() {
  const { t } = useLang();
  return (
    <section style={{ borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)', background: 'white' }}>
      <div style={{
        maxWidth: 1240, margin: '0 auto', padding: '36px 32px',
        display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 32,
      }}>
        {t.stats.map((s, i) => (
          <div key={i} style={{
            display: 'flex', flexDirection: 'column', gap: 4,
            paddingInlineStart: i > 0 ? 32 : 0,
            borderInlineStart: i > 0 ? '1px solid var(--line)' : 'none',
          }}>
            <div className="tabular" style={{
              fontSize: 48, fontWeight: 700, letterSpacing: '-0.03em',
              color: 'var(--ink)', lineHeight: 1,
            }}>{s.n}</div>
            <div style={{ fontSize: 14, color: 'var(--ink-3)' }}>{s.l}</div>
          </div>
        ))}
      </div>
    </section>
  );
}

// ─── Features grid ────────────────────────────────────────────
function AFeatures() {
  const { t } = useLang();
  return (
    <section id="features" style={{ padding: '100px 32px 80px' }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <SectionHead eyebrow={t.features.eyebrow} title={t.features.title} sub={t.features.sub}/>

        <div style={{
          marginTop: 56,
          display: 'grid',
          gridTemplateColumns: 'repeat(6, 1fr)',
          gridAutoRows: 'minmax(0, auto)',
          gap: 16,
        }}>
          {/* Spotlight first card spans 3 cols, taller */}
          <FeatureCard k={t.features.list[0]} span={3} spotlight={true}/>
          <FeatureCard k={t.features.list[1]} span={3}/>
          <FeatureCard k={t.features.list[2]} span={2}/>
          <FeatureCard k={t.features.list[3]} span={2}/>
          <FeatureCard k={t.features.list[4]} span={2}/>
          <FeatureCard k={t.features.list[5]} span={3}/>
          <FeatureCard k={t.features.list[6]} span={3} dark={true}/>
        </div>
      </div>
    </section>
  );
}

function FeatureCard({ k, span = 2, spotlight = false, dark = false }) {
  const { lang } = useLang();
  return (
    <div style={{
      gridColumn: `span ${span}`,
      background: dark ? 'var(--ink)' : spotlight ? 'white' : 'white',
      color: dark ? 'white' : 'var(--ink)',
      borderRadius: 24,
      padding: spotlight ? 32 : 24,
      border: dark ? 'none' : '1px solid var(--line)',
      minHeight: spotlight ? 320 : 200,
      display: 'flex', flexDirection: 'column',
      position: 'relative', overflow: 'hidden',
    }}>
      {/* Icon */}
      <div style={{
        width: 44, height: 44, borderRadius: 14,
        background: dark ? 'rgba(255,255,255,0.1)' : spotlight ? 'var(--brand)' : 'var(--paper-2)',
        color: dark ? 'var(--brand)' : spotlight ? 'white' : 'var(--ink)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        marginBottom: 20,
      }}>
        <Icon name={k.k} size={22} stroke={2}/>
      </div>

      <div style={{
        fontSize: spotlight ? 24 : 18,
        fontWeight: 700, letterSpacing: '-0.01em',
        lineHeight: 1.2, marginBottom: 8,
      }}>{k.t}</div>
      <div style={{
        fontSize: spotlight ? 15 : 14,
        lineHeight: 1.55,
        color: dark ? 'rgba(255,255,255,0.7)' : 'var(--ink-3)',
        maxWidth: spotlight ? 380 : '100%',
      }}>{k.d}</div>

      {spotlight && (
        <div style={{
          position: 'absolute', bottom: -40, [lang==='ar'?'left':'right']: -30,
          width: 240, height: 240,
          background: 'radial-gradient(closest-side, rgba(250, 83, 6, 0.12), transparent 70%)',
        }}/>
      )}

      {/* Inline mini visuals for some cards */}
      {k.k === 'fuel' && <MiniSparkline brand="var(--brand)"/>}
      {k.k === 'history' && <MiniTimeline dark={dark}/>}
    </div>
  );
}

function MiniSparkline({ brand }) {
  return (
    <div style={{ marginTop: 'auto', paddingTop: 16 }}>
      <svg width="100%" height="36" viewBox="0 0 200 36" preserveAspectRatio="none">
        <path d="M0 28 Q 25 26 40 22 T 80 18 T 120 14 T 160 16 T 200 8" stroke={brand} strokeWidth="2" fill="none" strokeLinecap="round"/>
        <path d="M0 28 Q 25 26 40 22 T 80 18 T 120 14 T 160 16 T 200 8 L 200 36 L 0 36 Z" fill={brand} opacity="0.08"/>
        <circle cx="200" cy="8" r="3" fill={brand}/>
      </svg>
    </div>
  );
}

function MiniTimeline({ dark }) {
  const c = dark ? 'rgba(255,255,255,0.4)' : 'var(--line)';
  const dot = dark ? 'var(--brand)' : 'var(--brand)';
  return (
    <div style={{ marginTop: 'auto', paddingTop: 16, display: 'flex', flexDirection: 'column', gap: 6 }}>
      {[0,1,2].map(i => (
        <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ width: 7, height: 7, borderRadius: 99, background: i === 0 ? dot : c, flexShrink: 0 }}/>
          <span style={{ flex: 1, height: 1, background: c }}/>
          <span className="tabular" style={{ fontSize: 11, color: dark ? 'rgba(255,255,255,0.5)' : 'var(--ink-4)' }}>
            {['Mar 12', 'Feb 04', 'Dec 18'][i]}
          </span>
        </div>
      ))}
    </div>
  );
}

function SectionHead({ eyebrow, title, sub }) {
  return (
    <div style={{ maxWidth: 720 }}>
      <div style={{
        display: 'inline-block',
        fontSize: 12, fontWeight: 700, letterSpacing: '0.12em',
        color: 'var(--brand)', textTransform: 'uppercase',
        marginBottom: 14,
      }}>{eyebrow}</div>
      <h2 style={{
        margin: 0,
        fontSize: 'clamp(34px, 4.5vw, 56px)',
        fontWeight: 700, letterSpacing: '-0.025em',
        lineHeight: 1.05,
        color: 'var(--ink)',
        textWrap: 'balance',
      }}>{title}</h2>
      {sub && <p style={{
        marginTop: 16, fontSize: 17, lineHeight: 1.55, color: 'var(--ink-3)', maxWidth: 600,
      }}>{sub}</p>}
    </div>
  );
}

// ─── How it works ─────────────────────────────────────────────
function AHowItWorks() {
  const { t, lang } = useLang();
  const isAr = lang === 'ar';

  return (
    <section id="how" style={{
      background: 'var(--paper-2)',
      padding: '100px 32px',
      borderRadius: 0,
    }}>
      <div style={{ maxWidth: 1240, margin: '0 auto' }}>
        <SectionHead eyebrow={t.how.eyebrow} title={t.how.title} sub={t.how.sub}/>

        <div style={{
          marginTop: 64,
          display: 'grid',
          gridTemplateColumns: '1fr 1fr 1fr',
          gap: 32,
          alignItems: 'start',
        }}>
          {t.how.steps.map((s, i) => (
            <div key={i} style={{ display: 'flex', flexDirection: 'column', gap: 24 }}>
              {/* Phone */}
              <div style={{
                position: 'relative',
                display: 'flex', justifyContent: 'center',
                background: 'white',
                borderRadius: 32,
                padding: '40px 0 0',
                overflow: 'hidden',
                height: 460,
                border: '1px solid var(--line)',
              }}>
                <div style={{ transform: 'scale(0.78)', transformOrigin: 'top center' }}>
                  <IOSDevice width={300} height={640} dark={i === 1}>
                    {i === 0 && <PhoneCars brand="var(--brand)"/>}
                    {i === 1 && <PhoneOCR brand="var(--brand)"/>}
                    {i === 2 && <PhoneDashboard brand="var(--brand)"/>}
                  </IOSDevice>
                </div>
              </div>

              <div>
                <div className="tabular" style={{
                  fontSize: 13, fontWeight: 700, letterSpacing: '0.04em',
                  color: 'var(--brand)', marginBottom: 10,
                }}>{s.n}</div>
                <div style={{ fontSize: 24, fontWeight: 700, letterSpacing: '-0.02em', marginBottom: 8 }}>{s.t}</div>
                <div style={{ fontSize: 15, lineHeight: 1.55, color: 'var(--ink-3)' }}>{s.d}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// ─── Final CTA ────────────────────────────────────────────────
function AFinalCTA() {
  const { t, lang } = useLang();
  const isAr = lang === 'ar';

  return (
    <section id="download" style={{ padding: '100px 32px' }}>
      <div style={{
        maxWidth: 1100, margin: '0 auto',
        background: 'var(--ink)', color: 'white',
        borderRadius: 40, padding: '80px 48px',
        position: 'relative', overflow: 'hidden',
        textAlign: 'center',
      }}>
        {/* Brand glow */}
        <div style={{
          position: 'absolute', top: -100, left: '50%', transform: 'translateX(-50%)',
          width: 600, height: 400,
          background: 'radial-gradient(closest-side, rgba(250,83,6,0.55), transparent 70%)',
        }}/>

        <div style={{ position: 'relative' }}>
          <h2 style={{
            margin: 0, fontSize: 'clamp(36px, 4.5vw, 56px)',
            fontWeight: 700, letterSpacing: '-0.025em', lineHeight: 1.05,
          }}>{isAr ? 'سيارتك تستحق الأفضل.' : 'Your car deserves better.'}</h2>
          <p style={{
            margin: '16px auto 32px', fontSize: 18,
            color: 'rgba(255,255,255,0.7)', maxWidth: 480, lineHeight: 1.55,
          }}>{isAr ? 'حمّل MOTR الآن وابدأ في تتبّع كل شيء — مجاناً.' : 'Download MOTR now and start tracking everything — for free.'}</p>
          <div style={{ display: 'inline-flex', gap: 12, flexWrap: 'wrap', justifyContent: 'center' }}>
            <a href="#" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '14px 22px', borderRadius: 14, background: 'white', color: 'var(--ink)', direction: 'ltr', whiteSpace: 'nowrap',
            }}>
              <Icon name="apple" size={22}/>
              <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t.hero.cta1}</span>
            </a>
            <a href="#" style={{
              display: 'inline-flex', alignItems: 'center', gap: 10,
              padding: '14px 22px', borderRadius: 14, background: 'white', color: 'var(--ink)', direction: 'ltr', whiteSpace: 'nowrap',
            }}>
              <Icon name="play" size={22}/>
              <span style={{ fontSize: 14.5, fontWeight: 600 }}>{t.hero.cta2}</span>
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}

// ─── Footer ───────────────────────────────────────────────────
function AFooter() {
  const { t } = useLang();
  return (
    <footer style={{ borderTop: '1px solid var(--line)', padding: '40px 32px 60px' }}>
      <div style={{
        maxWidth: 1240, margin: '0 auto',
        display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start',
        gap: 40, flexWrap: 'wrap',
      }}>
        <div style={{ maxWidth: 360 }}>
          <Wordmark/>
          <p style={{ fontSize: 14, color: 'var(--ink-3)', marginTop: 14, lineHeight: 1.55 }}>{t.footer.tagline}</p>
        </div>
        <div style={{ display: 'flex', gap: 28, fontSize: 14, fontWeight: 500, color: 'var(--ink-2)' }}>
          {t.footer.links.map((l, i) => <a key={i} href={l.h}>{l.t}</a>)}
        </div>
      </div>
      <div style={{
        maxWidth: 1240, margin: '32px auto 0',
        paddingTop: 24, borderTop: '1px solid var(--line-soft)',
        fontSize: 12.5, color: 'var(--ink-4)',
      }}>{t.footer.rights}</div>
    </footer>
  );
}

Object.assign(window, { DirectionA });
