import { DataTypes } from 'sequelize';

export default function defineCourierOperator(sequelize) {
  return sequelize.define(
    'CourierOperator',
    {
      code: { type: DataTypes.STRING(50), primaryKey: true },
      enabled: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: true },
      settings: { type: DataTypes.JSON, allowNull: false },
      runtime: { type: DataTypes.JSON, allowNull: false },
      credentialsEnv: { type: DataTypes.JSON, allowNull: false },
    },
    { tableName: 'courier_operators', underscored: true },
  );
}
