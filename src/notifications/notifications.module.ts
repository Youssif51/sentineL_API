import { Module } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { EmailService } from './email.service';
import { MailProcessor } from './mail.processor';

@Module({
  imports: [
    // تعريف الـ Queue الخاص بالإيميلات
    BullModule.registerQueue({
      name: 'mail-queue',
    }),
  ],
  providers: [EmailService, MailProcessor],
  exports: [EmailService, BullModule], // بنعمل export للـ BullModule عشان نستخدم الـ Queue بره
})
export class EmailModule {}
