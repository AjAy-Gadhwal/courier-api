import { createHash } from 'node:crypto';

const dedupeKey = (event) =>
  createHash('sha1')
    .update([event.source, event.status, event.courierStatus ?? '', event.occurredAt, event.location ?? ''].join('|'))
    .digest('hex');

export class TrackingEventRepository {
  constructor(models) {
    this.TrackingEvent = models.TrackingEvent;
  }

  async append(orderId, events) {
    if (!events.length) return;
    const recordedAt = new Date();
    await this.TrackingEvent.bulkCreate(
      events.map((event) => ({
        orderId,
        source: event.source,
        status: event.status,
        courierStatus: event.courierStatus ?? null,
        description: event.description?.slice(0, 500) ?? null,
        location: event.location?.slice(0, 200) ?? null,
        occurredAt: new Date(event.occurredAt),
        recordedAt,
        rawPayload: event.raw ?? null,
        dedupeKey: dedupeKey(event),
      })),
      { ignoreDuplicates: true },
    );
  }

  async list(orderId) {
    const rows = await this.TrackingEvent.findAll({
      where: { orderId },
      order: [
        ['occurredAt', 'ASC'],
        ['id', 'ASC'],
      ],
    });
    return rows.map((row) => {
      const e = row.get();
      return {
        id: e.id,
        orderId: e.orderId,
        source: e.source,
        status: e.status,
        courierStatus: e.courierStatus,
        description: e.description,
        location: e.location,
        occurredAt: new Date(e.occurredAt).toISOString(),
        recordedAt: new Date(e.recordedAt).toISOString(),
        rawPayload: e.rawPayload,
      };
    });
  }
}
