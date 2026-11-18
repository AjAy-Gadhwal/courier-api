import { Router } from 'express';
import { validate } from '../../middlewares/validate.middleware.js';
import { operatorPatchSchema } from '../../validations/operator.validation.js';

export function createOperatorRoutes({ operator }) {
  const router = Router();

  router.get('/', operator.list);
  router.get('/:code', operator.getOne);
  router.patch('/:code', validate({ body: operatorPatchSchema }), operator.update);

  return router;
}
