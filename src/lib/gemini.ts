export interface OdometerScanResult {
  mileage: number;
  make?: string;
  model?: string;
  confidence: number;
}

export async function scanOdometer(base64Image: string): Promise<OdometerScanResult> {
  const res = await fetch('/api/scan-odometer', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ image: base64Image, mimeType: 'image/jpeg' }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Odometer scan failed (${res.status}): ${detail || res.statusText}`);
  }
  return (await res.json()) as OdometerScanResult;
}
