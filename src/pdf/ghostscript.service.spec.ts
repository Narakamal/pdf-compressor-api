// src/pdf/ghostscript.service.spec.ts
import { Test } from '@nestjs/testing';
import { GhostscriptService } from './ghostscript.service';

describe('GhostscriptService', () => {
    let service: GhostscriptService;

    beforeEach(async () => {
        const module = await Test.createTestingModule({
            providers: [GhostscriptService],
        }).compile();

        service = module.get(GhostscriptService);
    });

    describe('checkGsAvailable()', () => {
        it('harus return string (path binary) atau null — tidak boleh throw', async () => {
            // Di Windows → biasanya null jika belum install
            // Di Ubuntu CI → biasanya string jika sudah apt install ghostscript
            const result = await service.checkGsAvailable();

            // Yang kita test: fungsi tidak boleh crash apapun kondisi OS-nya
            expect(result === null || typeof result === 'string').toBe(true);
        });

        it('jika GS tersedia, path harus mengandung nama binary yang valid', async () => {
            const result = await service.checkGsAvailable();

            if (result === null) {
                // GS tidak terinstall di mesin ini — skip assertion lanjutan
                console.warn('⚠️  Ghostscript tidak terinstall, test ini di-skip');
                return;
            }

            // GS terinstall — path harus mengandung 'gs' atau 'gswin'
            expect(result).toMatch(/gs/i);
        });
    });
});