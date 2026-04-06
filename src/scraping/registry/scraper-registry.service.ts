import { Injectable, OnModuleInit, UnprocessableEntityException } from '@nestjs/common';
import { IScraperAdapter } from '../adapters/scraper-adapter.interface';
import { SigmaAdapter } from '../adapters/sigma.adapter';
import { AlfrensiaAdapter } from '../adapters/alfrensia.adapter';
import { ElbadrAdapter } from '../adapters/el-badr.adapter';
import { KimoAdapter } from '../adapters/kimo.adapter';
import { GamesWorldAdapter } from '../adapters/games-world.adapter';

export const ALLOWED_DOMAINS = [
  'sigma-computer.com',
  'alfrensia.com',
  'elbadrgroupeg.store',
  'kimostore.net',
  'gamesworldegypt.com',
] as const;

export type AllowedDomain = (typeof ALLOWED_DOMAINS)[number];

@Injectable()
export class ScraperRegistryService implements OnModuleInit {
  private readonly registry = new Map<string, IScraperAdapter>();

  constructor(
    private sigma: SigmaAdapter,
    private alfrensia: AlfrensiaAdapter,
    private elBadr: ElbadrAdapter,
    private kimo: KimoAdapter,
    private gamesWorld: GamesWorldAdapter,
  ) {}

  onModuleInit(): void {
    [this.sigma, this.alfrensia, this.elBadr, this.kimo, this.gamesWorld].forEach((a) =>
      this.registry.set(a.storeDomain, a),
    );
  }

  resolve(url: string): IScraperAdapter { // resolve the adapter from the url like SigmaAdapter like "sigma-computer.com": SigmaAdapter()
    const domain = this.parseDomain(url); // parse the domain from the url like sigma-computer.com
    const adapter = this.registry.get(domain); // get the adapter from the registry like SigmaAdapter with all the methods
    if (!adapter) {
      throw new UnprocessableEntityException(
        `Store "${domain}" is not supported. Allowed: ${ALLOWED_DOMAINS.join(', ')}`,
      );
    }
    return adapter;
  }

  detectStore(url: string): string {
    const domain = this.parseDomain(url);
    if (!ALLOWED_DOMAINS.includes(domain as AllowedDomain)) {
      throw new UnprocessableEntityException(
        `URL domain "${domain}" is not in the list of tracked stores.`,
      );
    }
    return domain;
  }

  getAllAdapters(): IScraperAdapter[] {
    return Array.from(this.registry.values());
  }

  isAllowedDomain(url: string): boolean {
    try {
      return ALLOWED_DOMAINS.includes(this.parseDomain(url) as AllowedDomain);
    } catch {
      return false;
    }
  }

  private parseDomain(url: string): string {
    try {
      return new URL(url).hostname.replace(/^www\./, '');
    } catch {
      throw new UnprocessableEntityException(`Invalid URL: ${url}`);
    }
  }
}
