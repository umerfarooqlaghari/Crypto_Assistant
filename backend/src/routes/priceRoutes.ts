import { Router} from 'express';    
import { getBinancePrice} from '../controllers/priceController';

const router = Router();

router.get('/price', getBinancePrice)

export default router;