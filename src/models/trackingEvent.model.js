import { DataTypes } from 'sequelize';

export default function defineTrackingEvent(sequelize) {
  const TrackingEvent = sequelize.define(
    'TrackingEvent',
    {
      id: { type: DataTypes.INTEGER, primaryKey: true, autoIncrement: true },
      orderId: { type: DataTypes.STRING(64), allowNull: false },
      source: { type: DataTypes.STRING(10), allowNull: false },
      status: { type: DataTypes.STRING(30), allowNull: false },
      courierStatus: { type: DataTypes.STRING(100), allowNull: true },
      description: { type: DataTypes.STRING(500), allowNull: true },
      location: { type: DataTypes.STRING(200), allowNull: true },
      occurredAt: { type: DataTypes.DATE(3), allowNull: false },
      recordedAt: { type: DataTypes.DATE(3), allowNull: false },
      rawPayload: { type: DataTypes.JSON, allowNull: true },
      dedupeKey: { type: DataTypes.STRING(40), allowNull: false },
    },
    {
      tableName: 'tracking_events',
      underscored: true,
      timestamps: false,
      indexes: [{ unique: true, fields: ['order_id', 'dedupe_key'] }, { fields: ['order_id', 'occurred_at'] }],
    },
  );

  const rejectChange = () => {
    throw new Error('tracking_events is append-only');
  };
  TrackingEvent.beforeUpdate(rejectChange);
  TrackingEvent.beforeDestroy(rejectChange);
  TrackingEvent.beforeBulkUpdate(rejectChange);
  TrackingEvent.beforeBulkDestroy(rejectChange);

  return TrackingEvent;
}
