import { SetMetadata } from '@nestjs/common';
import { BULLPEN_QUEUE_METADATA } from '../constants';
import type { BullpenQueueOptions } from '../interfaces/bullpen-options.interface';

/**
 * Enriches how a queue appears in the dashboard. Place it on the queue's `@Processor` class.
 *
 * @example
 * ```ts
 * @BullpenQueue({ description: 'Outbound email', group: 'Comms', danger: true })
 * @Processor('emails')
 * export class EmailsProcessor extends WorkerHost {}
 * ```
 */
export const BullpenQueue = (options: BullpenQueueOptions = {}): ClassDecorator =>
  SetMetadata(BULLPEN_QUEUE_METADATA, options);
