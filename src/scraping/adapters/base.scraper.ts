import { Logger } from '@nestjs/common';
import axios, { AxiosInstance, AxiosProxyConfig } from 'axios';
import { IScraperAdapter, ScrapedProduct } from './scraper-adapter.interface';
import { randomJitter } from '../anti-bot/jitter.helper';
import { UaRotationService } from '../anti-bot/ua-rotation.service';
import { DomainRateLimiterService } from '../anti-bot/domain-rate-limiter.service';
import { ProxyService } from '../anti-bot/proxy.service';

export abstract class BaseScraper implements IScraperAdapter {
  abstract readonly storeDomain: string;
  protected readonly http: AxiosInstance;
  private readonly logger = new Logger(BaseScraper.name);

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
    const headers = { 'User-Agent': userAgent };

    if (!proxyConfig) {
      return this.scrape(url, headers);
    }

    try {
      return await this.scrape(url, headers, proxyConfig);
    } catch (error) {
      if (!this.shouldRetryDirect(error)) {
        throw error;
      }

      this.logger.warn(
        `Proxy attempt failed for ${domain}; retrying direct request. Reason: ${this.describeError(error)}`,
      );

      return this.scrape(url, headers);
    }
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

  private shouldRetryDirect(error: unknown): boolean {
    if (!axios.isAxiosError(error)) {
      return false;
    }

    return (
      error.code === 'ERR_FR_TOO_MANY_REDIRECTS' ||
      error.code === 'ECONNABORTED' ||
      error.code === 'ECONNRESET' ||
      error.code === 'ETIMEDOUT' ||
      error.code === 'ECONNREFUSED' ||
      error.response?.status === 403 ||
      error.response?.status === 407 ||
      error.response?.status === 429
    );
  }

  private describeError(error: unknown): string {
    if (axios.isAxiosError(error)) {
      return error.message;
    }

    if (error instanceof Error) {
      return error.message;
    }

    return 'unknown error';
  }
}
