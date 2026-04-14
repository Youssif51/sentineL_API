import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.scraper';
import { ScrapedProduct } from './scraper-adapter.interface';
import { UaRotationService } from '../anti-bot/ua-rotation.service';
import { DomainRateLimiterService } from '../anti-bot/domain-rate-limiter.service';
import { ProxyService } from '../anti-bot/proxy.service';
import { AxiosProxyConfig } from 'axios';
@Injectable()
export class AlfrensiaAdapter extends BaseScraper {
  readonly storeDomain = 'alfrensia.com';
  private readonly healthCheckUrl = 'https://alfrensia.com/ar/';

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

    const title = $('h1.product-title').first().text().trim();

    const priceText = $('.product-page-price').text() || $('.price').text();
    const price = this.parseEgpPrice(priceText);

    const inStock = $('.in-stock').length > 0;

    if (!title || isNaN(price)) {
      throw new Error(`AlfrensiaAdapter: Failed to parse product at ${url}`);
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
