import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.scraper';
import { ScrapedProduct } from './scraper-adapter.interface';

@Injectable()
export class GamesWorldAdapter extends BaseScraper {
  readonly storeDomain = 'gamesworldegypt.com';
  private readonly healthCheckUrl = 'https://www.gamesworldegypt.com/';

  async scrape(url: string): Promise<ScrapedProduct> {
    const { data } = await this.http.get<string>(url);
    const $ = cheerio.load(data);

    // 1. اصطياد الاسم (من الـ Meta Tag اللي طلع في الـ Terminal أول مرة)
    const title = $('meta[property="og:title"]').attr('content')?.trim() || 
                  $('h1').first().text().trim(); // Fallback سريع

    // 2. اصطياد السعر (الكلاس العبقري اللي إنت لسه جايبه)
    // بنستهدف السعر الجديد (live) عشان لو عليه خصم
    const priceText = $('.price-new-live').first().text().trim() || $('.price-new').first().text().trim();
    const price = this.parseEgpPrice(priceText);

    // 3. اصطياد المخزون 
    const inStock = $('.product-stock.in-stock').length > 0;

    // 4. حارس البوابة
    if (!title || isNaN(price)) {
      throw new Error(`GamesWorldAdapter: Failed to parse product at ${url}`);
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