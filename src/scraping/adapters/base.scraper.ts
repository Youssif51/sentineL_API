import axios, { AxiosInstance } from 'axios';
import { IScraperAdapter, ScrapedProduct } from './scraper-adapter.interface';

export abstract class BaseScraper implements IScraperAdapter {
  abstract readonly storeDomain: string;
  protected readonly http: AxiosInstance;

  constructor(userAgent?: string) {
    this.http = axios.create({
      timeout: 15_000,
      headers: {
        'User-Agent': userAgent ?? 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
        'Accept-Language': 'en-US,en;q=0.9',
        'Accept-Encoding': 'gzip, deflate, br',
      },
    });
  }

  abstract scrape(url: string): Promise<ScrapedProduct>;
  abstract isHealthy(): Promise<boolean>;

  protected parseEgpPrice(text: string): number {
    const cleaned = text
      .replace(/[^\d,.]/g, '')
      .replace(/,(\d{3})/g, '$1')
      .replace(',', '.');
    return parseFloat(cleaned);
  }

  protected extractDomain(url: string): string {
    return new URL(url).hostname.replace(/^www\./, '');
  }
}
