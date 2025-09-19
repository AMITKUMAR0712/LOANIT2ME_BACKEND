import fetch from 'node-fetch';

// Function to get PayPal access token
async function getPayPalAccessToken() {
    const clientId = process.env.PAYPAL_CLIENT_ID?.trim();
    const clientSecret = process.env.PAYPAL_CLIENT_SECRET?.trim();
    const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox'; // 'sandbox' or 'live'

    if (!clientId || !clientSecret) {
        throw new Error('PayPal credentials are required');
    }

    const baseURL = environment === 'live' 
        ? 'https://api.paypal.com' 
        : 'https://api.sandbox.paypal.com';

    const response = await fetch(`${baseURL}/v1/oauth2/token`, {
        method: 'POST',
        headers: {
            'Accept': 'application/json',
            'Accept-Language': 'en_US',
            'Authorization': `Basic ${Buffer.from(`${clientId}:${clientSecret}`).toString('base64')}`,
            'Content-Type': 'application/x-www-form-urlencoded'
        },
        body: 'grant_type=client_credentials'
    });

    const data = await response.json();
    
    if (!response.ok) {
        throw new Error(`PayPal auth failed: ${data.error_description || data.error}`);
    }

    return data.access_token;
}

// Function to send money via PayPal Payouts API
export async function sendPayPalPayout({ amount, recipientEmail, payerRole, receiverRole, loanId }) {
    try {
        const accessToken = await getPayPalAccessToken();
        const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
        
        const baseURL = environment === 'live' 
            ? 'https://api.paypal.com' 
            : 'https://api.sandbox.paypal.com';

        const payoutData = {
            sender_batch_header: {
                sender_batch_id: `loan_${loanId}_${Date.now()}`, // Unique batch ID
                email_subject: "You have a payment from LendingHands",
                email_message: `Payment from ${payerRole} for loan ${loanId}`
            },
            items: [{
                recipient_type: "EMAIL",
                amount: {
                    value: amount.toFixed(2),
                    currency: "USD"
                },
                receiver: recipientEmail,
                note: `${payerRole} to ${receiverRole} payment for loan ${loanId}`,
                sender_item_id: `payment_${Date.now()}`
            }]
        };

        const response = await fetch(`${baseURL}/v1/payments/payouts`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(payoutData)
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('PayPal payout error:', result);
            return {
                success: false,
                error: result.message || 'PayPal payout failed'
            };
        }

        console.log(`✅ PayPal payout sent: $${amount} to ${recipientEmail}`);
        
        return {
            success: true,
            payoutBatchId: result.batch_header.payout_batch_id,
            payoutItemId: result.items[0].payout_item_id,
            transactionId: result.batch_header.payout_batch_id,
            message: `Successfully sent $${amount} to ${recipientEmail}`
        };

    } catch (error) {
        console.error('PayPal payout error:', error);
        return {
            success: false,
            error: error.message || 'PayPal payout failed'
        };
    }
}

// Function to check payout status
export async function checkPayoutStatus(payoutBatchId) {
    try {
        const accessToken = await getPayPalAccessToken();
        const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
        
        const baseURL = environment === 'live' 
            ? 'https://api.paypal.com' 
            : 'https://api.sandbox.paypal.com';

        const response = await fetch(`${baseURL}/v1/payments/payouts/${payoutBatchId}`, {
            headers: {
                'Authorization': `Bearer ${accessToken}`
            }
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.message || 'Failed to check payout status'
            };
        }

        return {
            success: true,
            status: result.batch_header.batch_status,
            data: result
        };

    } catch (error) {
        console.error('PayPal status check error:', error);
        return {
            success: false,
            error: error.message || 'Status check failed'
        };
    }
}

// Function to create PayPal payment (for collecting money)
export async function createPayPalPayment({ amount, payerRole, receiverRole, loanId }) {
    try {
        const accessToken = await getPayPalAccessToken();
        const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
        
        const baseURL = environment === 'live' 
            ? 'https://api.paypal.com' 
            : 'https://api.sandbox.paypal.com';

        const frontendBaseURL = process.env.FRONTEND_URL;
        
        // Return to appropriate dashboard based on payer role
        const returnURL = payerRole === 'LENDER' 
            ? `${frontendBaseURL}/lender-dashboard`
            : `${frontendBaseURL}/borrower-dashboard`;
        
        const cancelURL = payerRole === 'LENDER' 
            ? `${frontendBaseURL}/lender-dashboard`
            : `${frontendBaseURL}/borrower-dashboard`;

        const paymentData = {
            intent: "sale",
            payer: {
                payment_method: "paypal"
            },
            transactions: [{
                amount: {
                    total: amount.toFixed(2),
                    currency: "USD"
                },
                description: `${payerRole} to ${receiverRole} payment for loan ${loanId}`,
                custom: `loan_${loanId}`,
                item_list: {
                    items: [{
                        name: `Loan Payment - ${payerRole} to ${receiverRole}`,
                        sku: `loan_${loanId}`,
                        price: amount.toFixed(2),
                        currency: "USD",
                        quantity: 1
                    }]
                }
            }],
            redirect_urls: {
                return_url: returnURL,
                cancel_url: cancelURL
            }
        };

        const response = await fetch(`${baseURL}/v1/payments/payment`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify(paymentData)
        });

        const result = await response.json();

        if (!response.ok) {
            console.error('PayPal payment creation error:', result);
            return {
                success: false,
                error: result.message || 'PayPal payment creation failed'
            };
        }

        // Find approval URL
        const approvalUrl = result.links.find(link => link.rel === 'approval_url')?.href;

        return {
            success: true,
            paymentId: result.id,
            approvalUrl: approvalUrl,
            transactionId: result.id
        };

    } catch (error) {
        console.error('PayPal payment creation error:', error);
        return {
            success: false,
            error: error.message || 'PayPal payment creation failed'
        };
    }
}

// Function to execute PayPal payment after approval
export async function executePayPalPayment(paymentId, payerId) {
    try {
        const accessToken = await getPayPalAccessToken();
        const environment = process.env.PAYPAL_ENVIRONMENT || 'sandbox';
        
        const baseURL = environment === 'live' 
            ? 'https://api.paypal.com' 
            : 'https://api.sandbox.paypal.com';

        const response = await fetch(`${baseURL}/v1/payments/payment/${paymentId}/execute`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${accessToken}`
            },
            body: JSON.stringify({
                payer_id: payerId
            })
        });

        const result = await response.json();

        if (!response.ok) {
            return {
                success: false,
                error: result.message || 'PayPal payment execution failed'
            };
        }

        return {
            success: result.state === 'approved',
            transactionId: result.id,
            status: result.state,
            data: result
        };

    } catch (error) {
        console.error('PayPal payment execution error:', error);
        return {
            success: false,
            error: error.message || 'PayPal payment execution failed'
        };
    }
}
