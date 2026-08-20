import { asyncHandler } from '../utils/asyncHandler.js';
import * as paymentRepo from '../repositories/paymentRepository.js';
import { errorResponses } from '../errors/AppError.js';
import { findTournament } from '../repositories/tournamentRepository.js';

export const getPaymentAccount = asyncHandler(async (req, res) => {
  const provider = req.query.provider || 'MANUAL_UPI';
  const account = await paymentRepo.findPaymentAccount(req.user.id, provider);
  res.status(200).json({ account });
});

export const connectPaymentAccount = asyncHandler(async (req, res) => {
  const { provider, providerAccountId, status, onboardingStatus, currency } = req.body;
  if (!provider) {
    throw errorResponses.validation({ provider: 'Provider is required' });
  }
  const id = await paymentRepo.upsertPaymentAccount(req.user.id, {
    provider,
    providerAccountId,
    status,
    onboardingStatus,
    currency,
  });
  const account = await paymentRepo.getPaymentAccountById(id);
  res.status(200).json({ account });
});

export const deletePaymentAccount = asyncHandler(async (req, res) => {
  const provider = req.body.provider || 'MANUAL_UPI';
  const deleted = await paymentRepo.deletePaymentAccount(req.user.id, provider);
  if (!deleted) {
    throw errorResponses.notFound('Payment account not found');
  }
  res.status(200).json({ success: true });
});

export const getTournamentPaymentSummary = asyncHandler(async (req, res) => {
  const tournamentId = Number(req.params.tournamentId);
  const tournament = await findTournament(tournamentId);
  if (!tournament) {
    throw errorResponses.notFound('Tournament not found');
  }
  if (tournament.organizer_id !== req.user.id) {
    throw errorResponses.forbidden();
  }
  const summary = await paymentRepo.getPaymentSummary(tournamentId);
  res.status(200).json({ summary });
});
