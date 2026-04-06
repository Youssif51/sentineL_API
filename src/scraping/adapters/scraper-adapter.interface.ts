export interface ScrapedProduct {
    title: string;
    price: number;
    currency: string;
    inStock: boolean;
    url: string;
    scrapedAt: Date;
  }
  
  export interface IScraperAdapter {
    readonly storeDomain: string;
    scrape(url: string): Promise<ScrapedProduct>;
    isHealthy(): Promise<boolean>;
  }
  