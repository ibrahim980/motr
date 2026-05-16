import { ServiceType, type TimelineEvent, type Vehicle } from '../types';
import { formatMileage } from './utils';
import type { Lang } from '../i18n';

type Translator = (key: string, vars?: Record<string, string | number>) => string;

const SERVICE_KEY: Record<string, string> = {
  [ServiceType.FUEL]: 'service.fuel',
  [ServiceType.OIL_CHANGE]: 'service.oil_change',
  [ServiceType.MAINTENANCE]: 'service.maintenance',
  [ServiceType.TIRES]: 'service.tires',
  [ServiceType.BATTERY]: 'service.battery',
  [ServiceType.PARTS]: 'service.parts',
  [ServiceType.OTHER]: 'service.other',
};

function esc(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function safeFileName(name: string): string {
  const cleaned = (name || 'vehicle')
    .trim()
    .replace(/[\\/:*?"<>|]/g, '')
    .replace(/\s+/g, '_')
    .slice(0, 80);
  return cleaned || 'vehicle';
}

function buildReportElement(
  vehicle: Vehicle,
  events: TimelineEvent[],
  t: Translator,
  lang: Lang
): HTMLDivElement {
  const isRtl = lang === 'ar';
  const dateLocale = isRtl ? 'ar-u-ca-gregory-nu-latn' : 'en-US';
  const formatDate = (s: string): string => {
    const d = new Date(s);
    return Number.isNaN(d.getTime()) ? '—' : d.toLocaleDateString(dateLocale);
  };

  // Localize the mileage unit (KM / كم) — formatMileage hardcodes "KM"
  // so swap the suffix based on the active locale.
  const kmUnit = t('common.km_unit');
  const formatMileageLocal = (km: number): string =>
    formatMileage(km).replace(/\s*KM$/i, ` ${kmUnit}`);

  const infoRows: Array<[string, string]> = [
    [t('reports.name'), vehicle.name],
    ...(vehicle.make ? ([[t('reports.make'), vehicle.make]] as Array<[string, string]>) : []),
    ...(vehicle.model ? ([[t('reports.model'), vehicle.model]] as Array<[string, string]>) : []),
    ...(vehicle.year ? ([[t('reports.year'), String(vehicle.year)]] as Array<[string, string]>) : []),
    ...(vehicle.color ? ([[t('reports.color'), vehicle.color]] as Array<[string, string]>) : []),
    [t('common.mileage'), formatMileageLocal(vehicle.currentMileage)],
  ];

  const eventsSorted = [...events].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );

  const container = document.createElement('div');
  // Render at the document origin, off-screen to the left so the user
  // never sees it but html2canvas still computes a proper bounding box.
  container.style.cssText = [
    'position: absolute',
    'top: 0',
    'left: -10000px',
    'width: 720px',
    'padding: 40px',
    'background: #ffffff',
    'color: #0F1115',
    'box-sizing: border-box',
    "font-family: 'Inter', 'IBM Plex Sans Arabic', system-ui, -apple-system, sans-serif",
    `direction: ${isRtl ? 'rtl' : 'ltr'}`,
    `text-align: ${isRtl ? 'right' : 'left'}`,
  ].join(';');

  const tableAlign = isRtl ? 'right' : 'left';

  const headerHtml = `
    <div style="display:flex;align-items:center;justify-content:space-between;gap:14px;border-bottom:3px solid #F26430;padding-bottom:14px;margin-bottom:22px;">
      <div>
        <div style="font-size:22px;font-weight:700;color:#F26430;margin:0 0 4px;">${esc(t('reports.title'))}</div>
        <div style="font-size:12px;color:#666;">${esc(formatDate(new Date().toISOString()))}</div>
      </div>
      <img src="/logo.svg" alt="MOTR" style="height:40px;width:auto;flex-shrink:0;" crossorigin="anonymous" />
    </div>
  `;

  const infoRowsHtml = infoRows
    .map(
      ([k, v]) => `
      <div style="display:flex;gap:12px;margin:6px 0;font-size:13px;">
        <span style="color:#666;min-width:110px;">${esc(k)}</span>
        <span style="font-weight:600;color:#0F1115;">${esc(v)}</span>
      </div>`
    )
    .join('');

  const infoHtml = `
    <div style="margin-bottom:22px;padding:18px;background:#F5F7FA;border-radius:14px;">
      <div style="font-size:13px;font-weight:700;margin:0 0 12px;text-transform:uppercase;letter-spacing:0.8px;color:#666;">${esc(t('reports.vehicle_info'))}</div>
      ${infoRowsHtml}
    </div>
  `;

  const tableHtml =
    eventsSorted.length === 0
      ? `<p style="font-size:13px;color:#888;font-style:italic;margin:8px 0 0;">${esc(t('reports.no_events'))}</p>`
      : `
    <table style="width:100%;border-collapse:collapse;font-size:12px;border:1px solid #E5E5E5;border-radius:8px;overflow:hidden;">
      <thead>
        <tr style="background:#F26430;color:#fff;">
          <th style="padding:10px 8px;text-align:${tableAlign};font-weight:700;">${esc(t('reports.date'))}</th>
          <th style="padding:10px 8px;text-align:${tableAlign};font-weight:700;">${esc(t('reports.service_type'))}</th>
          <th style="padding:10px 8px;text-align:${tableAlign};font-weight:700;">${esc(t('common.mileage'))}</th>
          <th style="padding:10px 8px;text-align:${tableAlign};font-weight:700;">${esc(t('reports.notes'))}</th>
        </tr>
      </thead>
      <tbody>
        ${eventsSorted
          .map(
            (e, i) => `
          <tr style="background:${i % 2 ? '#FAFAFA' : '#fff'};">
            <td style="padding:9px 8px;border-top:1px solid #EEE;white-space:nowrap;">${esc(formatDate(e.date))}</td>
            <td style="padding:9px 8px;border-top:1px solid #EEE;font-weight:600;">${esc(t(SERVICE_KEY[e.type] ?? 'service.other'))}</td>
            <td style="padding:9px 8px;border-top:1px solid #EEE;white-space:nowrap;">${esc(formatMileageLocal(e.mileage))}</td>
            <td style="padding:9px 8px;border-top:1px solid #EEE;color:#333;">${esc(e.notes ?? '—')}</td>
          </tr>`
          )
          .join('')}
      </tbody>
    </table>
  `;

  const historyHtml = `
    <div style="font-size:13px;font-weight:700;margin:0 0 10px;text-transform:uppercase;letter-spacing:0.8px;color:#666;">${esc(t('reports.history'))}</div>
    ${tableHtml}
  `;

  container.innerHTML = headerHtml + infoHtml + historyHtml;
  return container;
}

export async function generateVehicleReport(
  vehicle: Vehicle,
  events: TimelineEvent[],
  t: Translator,
  lang: Lang
): Promise<void> {
  // Pull jsPDF + html2canvas only when a report is actually generated,
  // so they never sit in the initial app bundle.
  const [{ default: jsPDF }, { default: html2canvas }] = await Promise.all([
    import('jspdf'),
    import('html2canvas'),
  ]);

  const element = buildReportElement(vehicle, events, t, lang);
  document.body.appendChild(element);

  try {
    // Let the browser finish laying out & loading the Arabic webfont.
    if (document.fonts?.ready) await document.fonts.ready;
    // Wait for any embedded images (e.g. the MOTR logo) to actually load.
    await Promise.all(
      Array.from(element.querySelectorAll('img')).map((img) =>
        img.complete && img.naturalWidth > 0
          ? Promise.resolve()
          : new Promise<void>((resolve) => {
              img.addEventListener('load', () => resolve(), { once: true });
              img.addEventListener('error', () => resolve(), { once: true });
            })
      )
    );
    await new Promise<void>((resolve) => requestAnimationFrame(() => resolve()));

    const canvas = await html2canvas(element, {
      scale: 2,
      backgroundColor: '#ffffff',
      useCORS: true,
      logging: false,
      windowWidth: element.offsetWidth,
      windowHeight: element.offsetHeight,
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });
    pdf.setProperties({
      title: `${t('reports.title')} — ${vehicle.name}`,
      subject: t('reports.title'),
      author: 'MOTR',
      creator: 'MOTR',
    });
    const pageWidth = pdf.internal.pageSize.getWidth();
    const pageHeight = pdf.internal.pageSize.getHeight();
    const imgWidth = pageWidth;
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    if (imgHeight <= pageHeight) {
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight, undefined, 'FAST');
    } else {
      // Multi-page: stitch the same tall image onto consecutive pages by
      // sliding it upward. Slight overlap on each page edge keeps rows
      // from being cut in half visually.
      let renderedHeight = 0;
      while (renderedHeight < imgHeight) {
        pdf.addImage(
          imgData,
          'PNG',
          0,
          -renderedHeight,
          imgWidth,
          imgHeight,
          undefined,
          'FAST'
        );
        renderedHeight += pageHeight;
        if (renderedHeight < imgHeight) pdf.addPage();
      }
    }

    pdf.save(`${safeFileName(vehicle.name)}_history.pdf`);
  } finally {
    document.body.removeChild(element);
  }
}
