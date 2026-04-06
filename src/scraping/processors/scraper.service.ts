import { Injectable } from '@nestjs/common';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { SCRAPE_QUEUE } from '../../queue/queue.constants';
import { ScrapeJobData } from './scrape-job.interface';

@Injectable()
export class ScraperService {
  constructor(@InjectQueue(SCRAPE_QUEUE) private readonly queue: Queue) {}

  async enqueueProduct(data: ScrapeJobData): Promise<void> {
    await this.queue.add('scrape', data, {
      priority: data.priority,
      attempts: 4,
      backoff: { type: 'exponential', delay: 5000 },
    });
  }

  async enqueueImmediate(data: ScrapeJobData): Promise<void> {
    await this.queue.add('scrape', data, {
      priority: 1,
      attempts: 4,
      backoff: { type: 'exponential', delay: 5000 },
      delay: 0,
    });
  }
}
