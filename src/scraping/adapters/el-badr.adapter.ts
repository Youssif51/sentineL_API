import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.scraper';
import { ScrapedProduct } from './scraper-adapter.interface';

@Injectable()
export class ElbadrAdapter extends BaseScraper {
  readonly storeDomain = 'elbadrgroupeg.store';
  // يفضل نحط رابط منتج مشهور دايماً موجود عشان الـ Health Check
  private readonly healthCheckUrl = 'https://elbadrgroupeg.store/msi-mpg-z890-edge-ti-wifi-lga-1851-ddr5-atx-motherboard'; 

  async scrape(url: string): Promise<ScrapedProduct> {
    const { data } = await this.http.get<string>(url);
    const $ = cheerio.load(data);

    // 1. اصطياد الاسم (من الـ span اللي إنت طلعته)
    const title = $('.page-title-text').first().text().trim() || $('h1.page-title').first().text().trim();

    // 2. اصطياد السعر (من الكلاس اللي طلعناه الخطوة اللي فاتت)
    const priceText = $('.product-price').first().text().trim();
    const price = this.parseEgpPrice(priceText);

    // 3. اصطياد المخزون (بناءً على التاج العبقري اللي إنت جبته)
    const inStock = $('.product-stock.in-stock').length > 0 || $('.in-stock').length > 0;

    // 4. حارس البوابة (لو فشل، هيضرب إيرور عشان نلحق نصلحه)
    if (!title || isNaN(price)) {
      throw new Error(`ElbadrAdapter: Failed to parse product at ${url}`);
    }

    return { title, price, currency: 'EGP', inStock, url, scrapedAt: new Date() };
  }

  async isHealthy(): Promise<boolean> {
    try {
      const { data } = await this.http.get<string>(this.healthCheckUrl);
      return data.length > 1000; // نتأكد إن الموقع مرجعش صفحة فاضية
    } catch {
      return false;
    }
  }
}