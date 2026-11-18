import { DataTypes } from 'sequelize';

export default function defineOrder(sequelize) {
  return sequelize.define(
    'Order',
    {
      orderId: { type: DataTypes.STRING(64), primaryKey: true },
      courierPartner: { type: DataTypes.STRING(50), allowNull: false },
      courierOrderId: { type: DataTypes.STRING(100), allowNull: true },
      awbNumber: { type: DataTypes.STRING(100), allowNull: true },
      status: { type: DataTypes.STRING(30), allowNull: false },
      labelUrl: { type: DataTypes.STRING(1000), allowNull: true },
      normalizedPayload: { type: DataTypes.JSON, allowNull: false },
      courierRequest: { type: DataTypes.JSON, allowNull: true },
      courierResponse: { type: DataTypes.JSON, allowNull: true },
      failureCode: { type: DataTypes.STRING(50), allowNull: true },
      failureMessage: { type: DataTypes.STRING(500), allowNull: true },
      needsReconciliation: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
      attempts: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
    },
    {
      tableName: 'orders',
      underscored: true,
      indexes: [{ fields: ['status'] }, { fields: ['needs_reconciliation'] }, { fields: ['courier_partner', 'awb_number'] }],
    },
  );
}
