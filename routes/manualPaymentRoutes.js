import express from 'express';
import { 
  handleScreenshotUpload, 
  uploadScreenshot,
  submitManualProof, 
  confirmManualPayment, 
  getPaymentDetails,
  validatePaymentMethods 
} from '../controllers/manualPaymentController.js';
import { verifyToken } from '../middleware/auth.js';

const router = express.Router();

// All routes require authentication
router.use(verifyToken);

// Upload screenshot for payment proof
router.post('/upload-screenshot', uploadScreenshot, handleScreenshotUpload);

// Submit manual payment proof
router.post('/submit-manual-proof', submitManualProof);

// Confirm or dispute manual payment
router.post('/confirm-manual-payment', confirmManualPayment);

// Get payment details
router.get('/:id', getPaymentDetails);

// Validate if borrower has required payment methods
router.post('/validate-payment-methods', validatePaymentMethods);

export default router;
