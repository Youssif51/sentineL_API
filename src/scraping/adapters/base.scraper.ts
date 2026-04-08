import axios, { AxiosInstance } from 'axios';
import { IScraperAdapter, ScrapedProduct } from './scraper-adapter.interface';
import { randomJitter } from '../anti-bot/jitter.helper';
import { UaRotationService } from '../anti-bot/ua-rotation.service';
import { DomainRateLimiterService } from '../anti-bot/domain-rate-limiter.service';

export abstract class BaseScraper implements IScraperAdapter {
  abstract readonly storeDomain: string;
  protected readonly http: AxiosInstance;

  constructor(
    private readonly uaRotation: UaRotationService,
    private readonly rateLimiter: DomainRateLimiterService,
  ) {
    this.http = axios.create({
      timeout: 15_000,
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });
  }

  async scrapeWithProtection(url: string): Promise<ScrapedProduct> {
    const domain = this.extractDomain(url);
    await this.rateLimiter.checkAndIncrement(domain);
    await randomJitter(3000);
    const userAgent = await this.uaRotation.getNextUa(domain);
    return this.scrape(url, { 'User-Agent': userAgent });
  }

  protected abstract scrape(url: string, headers: Record<string, string>): Promise<ScrapedProduct>;

  abstract isHealthy(): Promise<boolean>;

  protected parseEgpPrice(text: string): number {
    const cleaned = text
      .replace(/[^\d,.]/g, '')
      .replace(/,(\d{3})(?=[,.]|$)/g, '$1')
      .replace(',', '.');
    return parseFloat(cleaned);
  }

  protected extractDomain(url: string): string {
    return new URL(url).hostname.replace(/^www\./, '');
  }
}
