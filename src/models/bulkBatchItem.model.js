import { DataTypes } from 'sequelize';

export default function defineBulkBatchItem(sequelize) {
  return sequelize.define(
    'BulkBatchItem',
    {
      batchId: { type: DataTypes.STRING(36), primaryKey: true },
      idx: { type: DataTypes.INTEGER, primaryKey: true },
      orderId: { type: DataTypes.STRING(64), allowNull: true },
      courierPartner: { type: DataTypes.STRING(50), allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false },
      errorCode: { type: DataTypes.STRING(50), allowNull: true },
      errorMessage: { type: DataTypes.STRING(500), allowNull: true },
      errorDetails: { type: DataTypes.JSON, allowNull: true },
      payload: { type: DataTypes.JSON, allowNull: true },
    },
    { tableName: 'bulk_batch_items', underscored: true, timestamps: false, indexes: [{ fields: ['status'] }] },
  );
}
