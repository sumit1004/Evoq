import * as paymentRepo from '../repositories/paymentRepository.js';
import { errorResponses } from '../errors/AppError.js';

export class PaymentProvider {
  constructor(name) {
    this.name = name;
  }
  async createOrder(params) {
    throw new Error('Not implemented');
  }
  async verifyPayment(params) {
    throw new Error('Not implemented');
  }
}

export class ManualUPIPaymentProvider extends PaymentProvider {
  constructor() {
    super('MANUAL_UPI');
  }
  async createOrder(params) {
    return {
      status: 'PAYMENT_SUBMITTED',
      transactionReference: params.transactionId,
      proofUrl: params.paymentScreenshotPath,
      submittedAt: new Date(),
    };
  }
  async verifyPayment(params) {
    return { status: 'PAID', capturedAt: new Date() };
  }
}

export class RazorpayPaymentProvider extends PaymentProvider {
  constructor() {
    super('ONLINE');
  }
  async createOrder(params) {
    throw errorResponses.validation({ payment: 'Online payments are not configured for this tournament.' });
  }
  async verifyPayment(params) {
    throw errorResponses.validation({ payment: 'Online payments are not configured for this tournament.' });
  }
}

const providers = {
  MANUAL_UPI: new ManualUPIPaymentProvider(),
  ONLINE: new RazorpayPaymentProvider(),
};

export function getPaymentProvider(providerName) {
  const provider = providers[providerName];
  if (!provider) {
    throw new Error(`Unsupported payment provider: ${providerName}`);
  }
  return provider;
}

export async function createPayment(registrationId, tournament, organizerId, input, filename, connection) {
  const providerName = tournament.payment_method || (tournament.entry_type === 'PAID' ? 'MANUAL_UPI' : 'FREE');
  
  if (tournament.entry_type === 'FREE') {
    return await paymentRepo.insertPayment({
      registrationId,
      tournamentId: tournament.id,
      organizerId,
      provider: 'FREE',
      amount: 0,
      status: 'NOT_REQUIRED',
      paymentMethod: 'FREE',
    }, connection);
  }

  const provider = getPaymentProvider(providerName);
  const orderDetails = await provider.createOrder({
    transactionId: input.transactionId,
    paymentScreenshotPath: filename,
    amount: tournament.entry_fee,
  });

  return await paymentRepo.insertPayment({
    registrationId,
    tournamentId: tournament.id,
    organizerId,
    provider: providerName,
    amount: tournament.entry_fee,
    status: orderDetails.status,
    paymentMethod: providerName,
    transactionReference: orderDetails.transactionReference,
    proofUrl: orderDetails.proofUrl,
    submittedAt: orderDetails.submittedAt,
  }, connection);
}

export async function processWebhook(providerEventId, eventType, payload) {
  // Check if webhook event has already been processed
  const existingEvent = await paymentRepo.findPaymentEvent(providerEventId);
  if (existingEvent) {
    return { ok: true, msg: 'Duplicate webhook skipped (idempotent)' };
  }

  // Find payment associated with payload (mock integration logic)
  const providerOrderId = payload.order_id;
  if (!providerOrderId) {
    throw new Error('Invalid webhook payload: order_id missing');
  }

  // Insert payment event to guarantee idempotency first
  await paymentRepo.insertPaymentEvent({
    providerEventId,
    eventType,
    payload,
  });

  return { ok: true, processed: true };
}
