// src/common/utils/file.util.spec.ts
import {
    isPdfByMagicBytes,
    hasBombSignature,
    generateDownloadToken,
    verifyDownloadToken,
} from './file.util';

describe('FileUtil', () => {

    describe('isPdfByMagicBytes()', () => {
        it('harus return true untuk buffer yang diawali %PDF', () => {
            const validPdf = Buffer.from('%PDF-1.4 fake content');
            expect(isPdfByMagicBytes(validPdf)).toBe(true);
        });

        it('harus return false untuk file bukan PDF', () => {
            const fakePdf = Buffer.from('PK\x03\x04 ini file zip');   // ZIP header
            expect(isPdfByMagicBytes(fakePdf)).toBe(false);
        });

        it('harus return false untuk buffer kosong', () => {
            expect(isPdfByMagicBytes(Buffer.alloc(0))).toBe(false);
        });

        it('harus return false untuk buffer kurang dari 4 byte', () => {
            expect(isPdfByMagicBytes(Buffer.from('%PD'))).toBe(false);
        });
    });

    describe('hasBombSignature()', () => {
        it('harus return false untuk PDF normal', () => {
            // PDF normal punya jauh di bawah 10.000 object
            const normalPdf = Buffer.from(
                Array.from({ length: 10 }, (_, i) => `${i} 0 obj\n<<>>\nendobj`).join('\n')
            );
            expect(hasBombSignature(normalPdf)).toBe(false);
        });

        it('harus return true jika object count melewati batas', () => {
            // Simulasi PDF dengan object sangat banyak
            const bombContent = Array.from(
                { length: 10_001 },
                (_, i) => `${i} 0 obj`
            ).join('\n');
            expect(hasBombSignature(Buffer.from(bombContent))).toBe(true);
        });
    });

    describe('generateDownloadToken() dan verifyDownloadToken()', () => {
        const secret = 'test-secret-32-karakter-panjangnya';
        const jobId = 'job-uuid-123';

        it('token yang di-generate harus bisa diverifikasi', () => {
            const token = generateDownloadToken(jobId, secret);
            expect(verifyDownloadToken(jobId, token, secret)).toBe(true);
        });

        it('token yang salah harus gagal verifikasi', () => {
            const token = generateDownloadToken(jobId, secret);
            const fakeToken = token.replace(/.$/, 'x'); // ubah 1 karakter
            expect(verifyDownloadToken(jobId, fakeToken, secret)).toBe(false);
        });

        it('token untuk jobId berbeda tidak boleh valid', () => {
            const token = generateDownloadToken('job-lain', secret);
            expect(verifyDownloadToken(jobId, token, secret)).toBe(false);
        });

        it('token harus berupa string hex 64 karakter', () => {
            const token = generateDownloadToken(jobId, secret);
            expect(token).toMatch(/^[a-f0-9]{64}$/);
        });
    });
});