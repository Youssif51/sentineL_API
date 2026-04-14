import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.scraper';
import { ScrapedProduct } from './scraper-adapter.interface';
import { UaRotationService } from '../anti-bot/ua-rotation.service';
import { DomainRateLimiterService } from '../anti-bot/domain-rate-limiter.service';
import { ProxyService } from '../anti-bot/proxy.service';
import { AxiosProxyConfig } from 'axios';
@Injectable()
export class SigmaAdapter extends BaseScraper {
  readonly storeDomain = 'sigma-computer.com';
  private readonly healthCheckUrl = 'https://www.sigma-computer.com/';

  constructor(ua: UaRotationService, rl: DomainRateLimiterService, proxyService: ProxyService) {
    super(ua, rl, proxyService);
  }

  protected async scrape(
    url: string,
    headers: Record<string, string>,
    proxy: AxiosProxyConfig,
  ): Promise<ScrapedProduct> {
    const { data } = await this.http.get<string>(url, { headers, proxy });
    const $ = cheerio.load(data);

    const title = $('meta[name="twitter:title"]').attr('content')?.trim() || '';

    const priceText = $('meta[name="product:price:amount"]').attr('content');
    const price = priceText ? parseFloat(priceText) : NaN;

    const availability = $('meta[name="product:availability"]').attr('content')?.toLowerCase();
    const inStock = availability === 'in stock';

    if (!title || isNaN(price)) {
      throw new Error(`SigmaAdapter: Failed to parse product at ${url}`);
    }

    return { title, price, currency: 'EGP', inStock, url, scrapedAt: new Date() };
  }

  async isHealthy(): Promise<boolean> {
    try {
      const { data } = await this.http.get<string>(this.healthCheckUrl);
      return data.length > 1000;
    } catch {
      return false;
    }
  }
}
