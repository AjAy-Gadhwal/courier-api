const toRecord = (row) => {
  const o = row.get();
  return {
    code: o.code,
    enabled: Boolean(o.enabled),
    settings: o.settings,
    runtime: o.runtime,
    credentialsEnv: o.credentialsEnv,
    updatedAt: new Date(o.updatedAt).toISOString(),
  };
};

export class CourierOperatorRepository {
  constructor(models) {
    this.CourierOperator = models.CourierOperator;
  }

  async list() {
    const rows = await this.CourierOperator.findAll({ order: [['code', 'ASC']] });
    return rows.map(toRecord);
  }

  async find(code) {
    const row = await this.CourierOperator.findByPk(code);
    return row ? toRecord(row) : undefined;
  }

  async save({ code, enabled, settings, runtime, credentialsEnv }) {
    await this.CourierOperator.upsert({ code, enabled, settings, runtime, credentialsEnv });
    return this.find(code);
  }

  async seedMissing(seed) {
    const created = [];
    for (const [code, entry] of Object.entries(seed.couriers)) {
      if (await this.find(code)) continue;
      await this.save({
        code,
        enabled: entry.enabled,
        settings: entry.settings,
        runtime: entry.runtime,
        credentialsEnv: entry.credentialsEnv,
      });
      created.push(code);
    }
    return created;
  }
}
