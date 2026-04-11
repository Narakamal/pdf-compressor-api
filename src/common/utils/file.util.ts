import { createHmac, timingSafeEqual } from "crypto";

const PDF_MAGIC = Buffer.from('%PDF');

/**
 * Validasi magic bytes — jangan percaya MIME dari client
 */
export function isPdfByMagicBytes(buffer: Buffer): boolean {
    return buffer.subarray(0, 4).equals(PDF_MAGIC);
}

/**
 * PDF Bomb detection sederhana:
 * Hitung jumlah object stream — PDF sah jarang > 10.000
 */
export function hasBombSignature(buffer: Buffer): boolean {
    const content = buffer.toString('latin1');
    const objCount = (content.match(/\d+ \d+ obj/g) ?? []).length;
    const streamCount = (content.match(/stream\r?\n/g) ?? []).length;

    return objCount > 10_000 || streamCount > 5_000;
}

/**
 * Generate signed download token — hanya pemilik job yang bisa download
 */
export function generateDownloadToken(jobId: string, secret: string): string {
    return createHmac('sha256', secret).update(jobId).digest('hex');
}

export function verifyDownloadToken(jobId: string, token: string, secret: string): boolean {
    const expected = generateDownloadToken(jobId, secret);
    return timingSafeEqual(Buffer.from(token, 'hex'), Buffer.from(expected, 'hex'));
}