import express from 'express';
import { asyncHandler } from '../middleware/errorHandler';
import { getSingleExchangePrice } from '../controllers/getSignalExchangePriceController';

const router = express.Router();

router.get('/:exchange', asyncHandler(getSingleExchangePrice));

export default router;