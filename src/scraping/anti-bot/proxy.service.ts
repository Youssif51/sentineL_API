import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import axios from 'axios';

@Injectable()
export class ProxyService implements OnModuleInit {
  private readonly logger = new Logger(ProxyService.name);
  private proxies: string[] = [];

  constructor(private configService: ConfigService) {}

  // بيشتغل أوتوماتيك أول ما السيرفر يقوم
  async onModuleInit() {
    this.logger.log('🚀 Initializing Proxy Service...');
    await this.refreshProxyList();
  }

  // بيسحب اللستة من WebShare API
  async refreshProxyList() {
    const apiKey = this.configService.get<string>('WEBSHARE_API_KEY');
    if (!apiKey) {
      this.logger.error('❌ WEBSHARE_API_KEY is missing in .env');
      return;
    }

    try {
      const response = await axios.get('https://proxy.webshare.io/api/v2/proxy/list/', {
        params: {
          mode: 'direct', // 👈 ضيف السطر ده عشان تحل مشكلة "This field is required"
          page_size: 10,
        },
        headers: {
          Authorization: `Token ${apiKey}`,
        },
      });

      // تحويل الداتا للصيغة العالمية
      this.proxies = response.data.results.map(
        (p) => `http://${p.username}:${p.password}@${p.proxy_address}:${p.port}`,
      );

      this.logger.log(`✅ Loaded ${this.proxies.length} proxies from WebShare.`);
    } catch (error) {
      if (error.response) {
        // دي اللي هتحل اللغز: ويب شير هيرد عليك ويقولك "اليوزر غلط" أو "اللينك ناقص"
        console.error('--- WebShare Error Detail ---');
        console.error(error.response.data);
        console.error('-----------------------------');
        this.logger.error(`❌ WebShare API Error: ${error.response.status}`);
      } else {
        this.logger.error(`❌ Connection Error: ${error.message}`);
      }
    }
  }

  // بيدينا بروكسي عشوائي وقت السكرابينج
  getRandomProxy(): string | null {
    if (this.proxies.length === 0) return null;
    return this.proxies[Math.floor(Math.random() * this.proxies.length)];
  }
}
