import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getPublicOrganizations,
  getPublicOrganizationProfile,
  getOrganizationTournamentsList,
  getMyOrganizationProfile,
  updateMyOrganizationProfile,
} from '../services/organizationService.js';

export const listOrganizationsController = asyncHandler(async (req, res) => {
  const data = await getPublicOrganizations(req.query);
  res.status(200).json(data);
});

export const getOrganizationProfileController = asyncHandler(async (req, res) => {
  const organization = await getPublicOrganizationProfile(req.params.idOrSlug);
  res.status(200).json({ organization });
});

export const getOrganizationTournamentsController = asyncHandler(async (req, res) => {
  const data = await getOrganizationTournamentsList(req.params.idOrSlug, req.query);
  res.status(200).json(data);
});

export const getMyOrganizationController = asyncHandler(async (req, res) => {
  const organization = await getMyOrganizationProfile(req.user.id);
  res.status(200).json({ organization });
});

export const updateMyOrganizationController = asyncHandler(async (req, res) => {
  const organization = await updateMyOrganizationProfile(req.user.id, req.body);
  res.status(200).json({ organization });
});
