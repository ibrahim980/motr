export interface OdometerScanResult {
  mileage: number;
  make?: string;
  model?: string;
  confidence: number;
}

export type ScanErrorCode = 'quota_daily' | 'quota_hourly' | 'unavailable' | 'generic';

export class ScanError extends Error {
  code: ScanErrorCode;
  status: number;
  constructor(code: ScanErrorCode, status: number, message?: string) {
    super(message ?? code);
    this.code = code;
    this.status = status;
  }
}

export async function scanOdometer(base64Image: string): Promise<OdometerScanResult> {
  const res = await fetch('/api/scan-odometer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image, mimeType: 'image/jpeg' }),
  });

  if (res.status === 429) {
    const body = await res.json().catch(() => ({}));
    const code: ScanErrorCode =
      body?.error === 'quota_hourly' ? 'quota_hourly' : 'quota_daily';
    throw new ScanError(code, 429);
  }

  if (res.status === 503) {
    throw new ScanError('unavailable', 503);
  }

  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new ScanError('generic', res.status, detail || res.statusText);
  }

  return (await res.json()) as OdometerScanResult;
}
