import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.scraper';
import { ScrapedProduct } from './scraper-adapter.interface';
import { UaRotationService } from '../anti-bot/ua-rotation.service';
import { DomainRateLimiterService } from '../anti-bot/domain-rate-limiter.service';
import { ProxyService } from '../anti-bot/proxy.service';
import { AxiosProxyConfig } from 'axios';

@Injectable()
export class KimoAdapter extends BaseScraper {
  readonly storeDomain = 'kimostore.net';
  private readonly healthCheckUrl =
    'https://kimostore.net/collections/internal-1/products/hiksemi-wave-256gb-nvme-pcie-m-2-ssd';

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

    const title =
      $('meta[property="og:title"]').attr('content')?.trim() ||
      $('h1.product-meta__title').first().text().trim();

    const priceText =
      $('meta[property="product:price:amount"]').attr('content') || $('.price').first().text();
    const price = this.parseEgpPrice(priceText);

    const inventoryText = $('.product-form__inventory').text().toLowerCase();
    const inStock = inventoryText.includes('in stock') || inventoryText.includes('متوفر');

    if (!title || isNaN(price)) {
      throw new Error(`KimoAdapter: Failed to parse product at ${url}`);
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
