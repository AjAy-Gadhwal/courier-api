export function createHealthController({ orderService }) {
  return {
    check(_req, res) {
      res.json({ status: 'ok', couriers: orderService.supportedCouriers() });
    },
  };
}
