import { OnWorkerEvent, Processor, WorkerHost } from '@nestjs/bullmq';
import { Job } from 'bullmq';
import { EmailService, PriceAlertData } from './email.service';
import { Logger } from '@nestjs/common';

@Processor('mail-queue')
export class MailProcessor extends WorkerHost {
  private readonly logger = new Logger(MailProcessor.name);

  constructor(private readonly emailService: EmailService) {
    super(); // ضروري عشان الـ WorkerHost
  }

  // الميثود الأساسية اللي بتستقبل كل المهام
  async process(job: Job<any, any, string>): Promise<any> {
    this.logger.log(`Processing job ${job.id} of type ${job.name}`);

    // بنفرق بين المهام باستخدام اسم المهمة (job.name)
    switch (job.name) {
      case 'send-price-alert':
        return await this.emailService.sendPriceAlert(job.data as PriceAlertData);

      case 'send-lockout-notification':
        const { email, unlocksAt } = job.data;
        return await this.emailService.sendLockoutNotification(email, unlocksAt);

      default:
        this.logger.warn(`Unknown job name: ${job.name}`);
    }
  }

  // اختياري: إضافة مستمعين للأحداث زي الفشل أو النجاح
  @OnWorkerEvent('failed')
  onFormatQueueFailed(job: Job, error: Error) {
    this.logger.error(`Job ${job.id} failed: ${error.message}`);
  }
}
