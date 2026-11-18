import { DataTypes } from 'sequelize';

export default function defineBulkBatch(sequelize) {
  return sequelize.define(
    'BulkBatch',
    {
      batchId: { type: DataTypes.STRING(36), primaryKey: true },
      requestId: { type: DataTypes.STRING(100), allowNull: true },
      status: { type: DataTypes.STRING(20), allowNull: false },
      total: { type: DataTypes.INTEGER, allowNull: false },
      completedAt: { type: DataTypes.DATE(3), allowNull: true },
    },
    { tableName: 'bulk_batches', underscored: true },
  );
}
