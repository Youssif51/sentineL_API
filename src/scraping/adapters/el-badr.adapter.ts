import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.scraper';
import { ScrapedProduct } from './scraper-adapter.interface';
import { UaRotationService } from '../anti-bot/ua-rotation.service';
import { DomainRateLimiterService } from '../anti-bot/domain-rate-limiter.service';
import { ProxyService } from '../anti-bot/proxy.service';
import { AxiosProxyConfig } from 'axios';
@Injectable()
export class ElbadrAdapter extends BaseScraper {
  readonly storeDomain = 'elbadrgroupeg.store';
  private readonly healthCheckUrl =
    'https://elbadrgroupeg.store/msi-mpg-z890-edge-ti-wifi-lga-1851-ddr5-atx-motherboard';

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
      $('.page-title-text').first().text().trim() || $('h1.page-title').first().text().trim();

    const priceText =
      $('.product-price-new').first().text().trim() ||
      $('.product-price').first().text().trim() ||
      $('.price-group').first().text().trim();
    const price = this.parseEgpPrice(priceText);

    const inStock = $('.product-stock.in-stock').length > 0 || $('.in-stock').length > 0;

    if (!title || isNaN(price)) {
      throw new Error(`ElbadrAdapter: Failed to parse product at ${url}`);
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
