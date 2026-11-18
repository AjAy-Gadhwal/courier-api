import defineBulkBatch from './bulkBatch.model.js';
import defineBulkBatchItem from './bulkBatchItem.model.js';
import defineCourierOperator from './courierOperator.model.js';
import defineOrder from './order.model.js';
import defineTrackingEvent from './trackingEvent.model.js';

export function initModels(sequelize) {
  const Order = defineOrder(sequelize);
  const TrackingEvent = defineTrackingEvent(sequelize);
  const BulkBatch = defineBulkBatch(sequelize);
  const BulkBatchItem = defineBulkBatchItem(sequelize);
  const CourierOperator = defineCourierOperator(sequelize);

  Order.hasMany(TrackingEvent, { foreignKey: 'orderId' });
  TrackingEvent.belongsTo(Order, { foreignKey: 'orderId' });
  BulkBatch.hasMany(BulkBatchItem, { foreignKey: 'batchId' });
  BulkBatchItem.belongsTo(BulkBatch, { foreignKey: 'batchId' });

  return { Order, TrackingEvent, BulkBatch, BulkBatchItem, CourierOperator };
}
