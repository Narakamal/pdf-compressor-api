import { Test, TestingModule } from '@nestjs/testing';
import { GhostscriptService } from './ghostscript.service';

describe('GhostscriptService', () => {
    let service: GhostscriptService;

    beforeEach(async () => {
        const module: TestingModule = await Test.createTestingModule({
            providers: [GhostscriptService],
        }).compile();

        service = module.get<GhostscriptService>(GhostscriptService);
    });

    describe('checkGsAvailable()', () => {
        it('harus return string (path binary) atau null — tidak boleh throw', async () => {
            const result = await service.checkGsAvailable();
            expect(result === null || typeof result === 'string').toBe(true);
        });

        it('jika GS tersedia, path harus mengandung nama binary yang valid', async () => {
            const result = await service.checkGsAvailable();
            if (result === null) {
                console.warn('⚠️  Ghostscript tidak terinstall, test ini di-skip');
                return;
            }
            expect(result).toMatch(/gs/i);
        });
    });

    describe('isAvailable()', () => {
        it('harus return boolean — tidak boleh throw', () => {
            expect(typeof service.isAvailable()).toBe('boolean');
        });

        it('harus return false sebelum onApplicationBootstrap dipanggil', () => {
            expect(service.isAvailable()).toBe(false);
        });

        it('harus return true atau false setelah bootstrap (tergantung OS)', async () => {
            await service.onApplicationBootstrap();
            const available = service.isAvailable();
            expect(typeof available).toBe('boolean');
        });
    });

    describe('compress() — strict mode default', () => {
        it('harus throw GhostscriptNotInstalledError jika GS tidak tersedia (strict=true default)', async () => {
            await service.onApplicationBootstrap();

            if (service.isAvailable()) {
                console.warn('⚠️  GS tersedia di environment ini — skip test strict rejection');
                return;
            }

            const { GhostscriptNotInstalledError } = require('./ghostscript.service');
            const os = require('os');
            const path = require('path');
            const { writeFileSync, unlinkSync } = require('fs');

            const fakeInput = path.join(os.tmpdir(), 'fake-input-strict.pdf');
            writeFileSync(fakeInput, '%PDF-1.4 dummy');

            await expect(
                service.compress(fakeInput, os.tmpdir())
            ).rejects.toThrow(GhostscriptNotInstalledError);

            unlinkSync(fakeInput);
        });

        it('graceful fallback jika strict=false eksplisit', async () => {
            await service.onApplicationBootstrap();

            if (service.isAvailable()) {
                console.warn('⚠️  GS tersedia — skip graceful fallback test');
                return;
            }

            const os = require('os');
            const path = require('path');
            const { writeFileSync, unlinkSync } = require('fs');

            const fakeInput = path.join(os.tmpdir(), 'fake-fallback.pdf');
            writeFileSync(fakeInput, '%PDF-1.4 dummy content here');

            const result = await service.compress(fakeInput, os.tmpdir(), undefined, false);

            expect(result.skipped).toBe(true);
            expect(result.ratio).toBe(0);
            expect(result.sizeBefore).toBe(result.sizeAfter);

            unlinkSync(fakeInput);
            try { unlinkSync(path.join(os.tmpdir(), 'compressed.pdf')); } catch { }
        });
    });
});
