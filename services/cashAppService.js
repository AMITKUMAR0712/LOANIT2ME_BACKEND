
import Stripe from 'stripe';

// Function to get Stripe instance
function getStripeInstance() {
    const stripeSecretKey = process.env.STRIPE_SECRET_KEY?.trim();

    if (!stripeSecretKey) {
        console.error('STRIPE_SECRET_KEY is not set in environment variables');
        throw new Error('Stripe secret key is required');
    }

    if (!stripeSecretKey.startsWith('sk_')) {
        console.error('Invalid Stripe secret key format. Key should start with sk_test_ or sk_live_');
        throw new Error('Invalid Stripe secret key format');
    }

    return new Stripe(stripeSecretKey);
}

export async function callCashAppAPI({ amount, method, payerRole, receiverRole, paymentIntentId = null, fromCashApp = null, toCashApp = null }) {
    try {
        const stripe = getStripeInstance();

        // // If this is a confirmation of an existing payment intent
        // if (paymentIntentId) {
        //     const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
            
        //     if (paymentIntent.status === 'succeeded') {
        //         return { 
        //             success: true, 
        //             transactionId: paymentIntent.id,
        //             status: paymentIntent.status 
        //         };
        //     } else {
        //         return { 
        //             success: false, 
        //             error: `Payment status: ${paymentIntent.status}`,
        //             status: paymentIntent.status 
        //         };
        //     }
        // }

        // For CashApp payments, we'll create a payment intent with transfer
        if (method === 'CASHAPP') {
            const paymentIntent = await stripe.paymentIntents.create({
                amount: Math.round(amount * 100), // Convert to cents
                currency: 'usd',
                metadata: {
                    payerRole,
                    receiverRole,
                    method,
                    fromCashApp: fromCashApp || 'Not provided',
                    toCashApp: toCashApp || 'Not provided'
                },
                description: `${payerRole} to ${receiverRole} - From: ${fromCashApp || 'N/A'} To: ${toCashApp || 'N/A'}`,
                // Enable automatic payment methods including digital wallets
                automatic_payment_methods: {
                    enabled: true,
                },
            });

            console.log(`Created payment intent for $${amount} from ${fromCashApp} to ${toCashApp}`);

            return { 
                success: true, 
                transactionId: paymentIntent.id,
                clientSecret: paymentIntent.client_secret,
                status: paymentIntent.status,
                fromCashApp,
                toCashApp
            };
        }

        // For other payment methods, simulate success for now
        return { success: true, transactionId: `txn_${Date.now()}` };
        
    } catch (error) {
        console.error('Stripe payment error:', error);
        return { 
            success: false, 
            error: error.message || 'Payment processing failed' 
        };
    }
}

// New function to simulate CashApp transfer (In real implementation, this would use CashApp API)
export async function simulateCashAppTransfer({ amount, fromCashApp, toCashApp, transactionId }) {
    try {
        console.log(`🔄 Simulating CashApp transfer:`);
        console.log(`   Amount: $${amount}`);
        console.log(`   From: ${fromCashApp}`);
        console.log(`   To: ${toCashApp}`);
        console.log(`   Transaction ID: ${transactionId}`);
        
        // In a real implementation, you would:
        // 1. Use CashApp Business API to initiate transfer
        // 2. Wait for confirmation
        // 3. Return success/failure status
        
        // For now, we'll simulate success after a short delay
        await new Promise(resolve => setTimeout(resolve, 2000));
        
        console.log(`✅ CashApp transfer completed: ${fromCashApp} → ${toCashApp} ($${amount})`);
        
        return {
            success: true,
            transferId: `cashapp_transfer_${Date.now()}`,
            message: `Successfully transferred $${amount} from ${fromCashApp} to ${toCashApp}`
        };
        
    } catch (error) {
        console.error('CashApp transfer error:', error);
        return {
            success: false,
            error: error.message || 'CashApp transfer failed'
        };
    }
}

export async function confirmStripePayment(paymentIntentId) {
    try {
        const stripe = getStripeInstance();
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        return { 
            success: paymentIntent.status === 'succeeded', 
            transactionId: paymentIntent.id,
            status: paymentIntent.status 
        };
    } catch (error) {
        console.error('Stripe payment confirmation error:', error);
        return { 
            success: false, 
            error: error.message || 'Payment confirmation failed' 
        };
    }
}
