import axios, { AxiosInstance, AxiosProxyConfig } from 'axios';
import { IScraperAdapter, ScrapedProduct } from './scraper-adapter.interface';
import { randomJitter } from '../anti-bot/jitter.helper';
import { UaRotationService } from '../anti-bot/ua-rotation.service';
import { DomainRateLimiterService } from '../anti-bot/domain-rate-limiter.service';
import { ProxyService } from '../anti-bot/proxy.service';

export abstract class BaseScraper implements IScraperAdapter {
  abstract readonly storeDomain: string;
  protected readonly http: AxiosInstance;

  constructor(
    private readonly uaRotation: UaRotationService,
    private readonly rateLimiter: DomainRateLimiterService,
    private readonly proxyService: ProxyService,
  ) {
    this.http = axios.create({
      timeout: 15_000,
      headers: {
        Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });
  }

  async scrapeWithProtection(url: string): Promise<ScrapedProduct> {
    const domain = this.extractDomain(url);
    await this.rateLimiter.checkAndIncrement(domain);
    const proxyUrl = this.proxyService.getRandomProxy();
    const proxyConfig = proxyUrl ? this.parseProxyUrl(proxyUrl) : undefined;
    await randomJitter(3000);
    const userAgent = await this.uaRotation.getNextUa(domain);
    return this.scrape(url, { 'User-Agent': userAgent }, proxyConfig);
  }

  protected abstract scrape(
    url: string,
    headers: Record<string, string>,
    proxy?: AxiosProxyConfig,
  ): Promise<ScrapedProduct>;

  abstract isHealthy(): Promise<boolean>;

  private parseProxyUrl(proxyUrl: string): AxiosProxyConfig {
    const url = new URL(proxyUrl);
    return {
      protocol: url.protocol.replace(':', ''),
      host: url.hostname,
      port: parseInt(url.port),
      auth: {
        username: url.username,
        password: url.password,
      },
    };
  }

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
