import { Injectable } from '@nestjs/common';
import * as cheerio from 'cheerio';
import { BaseScraper } from './base.scraper';
import { ScrapedProduct } from './scraper-adapter.interface';  

@Injectable()
export class KimoAdapter extends BaseScraper {
  readonly storeDomain = 'kimostore.net';
  // رابط المنتج اللي إنت جبته ده ممتاز للفحص
  private readonly healthCheckUrl = 'https://kimostore.net/collections/internal-1/products/hiksemi-wave-256gb-nvme-pcie-m-2-ssd';

  async scrape(url: string): Promise<ScrapedProduct> {
    const { data } = await this.http.get<string>(url);
    const $ = cheerio.load(data);

    // 1. اصطياد الاسم (Meta Tag أولاً، وبعدين h1)
    const title = $('meta[property="og:title"]').attr('content')?.trim() || 
                  $('h1.product-meta__title').first().text().trim();

    // 2. اصطياد السعر
    const priceText = $('meta[property="product:price:amount"]').attr('content') || 
                      $('.price').first().text();
    const price = this.parseEgpPrice(priceText);

    // 3. اصطياد المخزون (بناءً على التاج اللي إنت طلعته)
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