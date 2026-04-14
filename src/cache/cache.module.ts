import { Global, Module } from '@nestjs/common';
import { CacheService } from './cache.service';

@Global() // بنخليه جلوبال عشان تستخدمه في أي حتة من غير ما تعمل import للموديول كل شوية
@Module({
  providers: [CacheService],
  exports: [CacheService], // بنصدر السيرفيس عشان باقي الكلاسات تشوفها
})
export class CacheModule {}
