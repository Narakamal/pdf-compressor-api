import { Injectable } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { StorageService } from 'src/pdf/pdf.storage.service';

@Injectable()
export class CleanupScheduler {
    constructor(private storage: StorageService) { }

    // Jalan setiap 5 menit
    @Cron('*/5 * * * *')
    async purge() {
        await this.storage.purgeExpired();
    }
}