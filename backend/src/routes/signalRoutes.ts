import { Router} from 'express';    
import { getSignals } from '../signalService';

const router = Router();

router.get('/signals', async (req, res)=> {
    try {
        const data = await getSignals();
        res.json(data);
    }
    catch(err)
    {
        console.error(err);
        res.status(500).json({error: 'Error genereating signals'});
    }
})
export default router;