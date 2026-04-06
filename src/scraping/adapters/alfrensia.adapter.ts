import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.scraper';
import { ScrapedProduct } from './scraper-adapter.interface';

@Injectable()
export class AlfrensiaAdapter extends BaseScraper {
  readonly storeDomain = 'alfrensia.com';
  private readonly healthCheckUrl = 'https://alfrensia.com/ar/';

  async scrape(url: string): Promise<ScrapedProduct> {
    const { data } = await this.http.get<string>(url);
    const $ = cheerio.load(data);

    // 1. الاسم (من الـ h1 اللي لقيناه في الـ Output بتاعك)
    const title = $('h1.product-title').first().text().trim();

    // 2. السعر (بننشن على الكلاسات المشهورة بتاعت WooCommerce اللي لقيناها)
    const priceText = $('.product-page-price').text() || $('.price').text();
    const price = this.parseEgpPrice(priceText);

    // 3. المخزون (لقينا كلاس in-stock واضح جداً)
    const inStock = $('.in-stock').length > 0;

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