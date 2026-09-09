import { asyncHandler } from '../utils/asyncHandler.js';
import {
  getMyOrganizationProfile,
  getOrganizationTournamentsList,
  getPublicOrganizationProfile,
  getPublicOrganizations,
  removeOrgBannerService,
  removeOrgLogoService,
  updateMyOrganizationProfile,
  uploadOrgBannerService,
  uploadOrgLogoService,
} from '../services/organizationService.js';
import { errorResponses } from '../errors/AppError.js';

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

export const uploadOrgLogoController = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw errorResponses.validation({ logo: 'A logo image file is required' });
  }
  const organization = await uploadOrgLogoService(req.user.id, req.file);
  res.status(200).json({ organization, message: 'Organization logo updated successfully' });
});

export const deleteOrgLogoController = asyncHandler(async (req, res) => {
  const organization = await removeOrgLogoService(req.user.id);
  res.status(200).json({ organization, message: 'Organization logo removed successfully' });
});

export const uploadOrgBannerController = asyncHandler(async (req, res) => {
  if (!req.file) {
    throw errorResponses.validation({ banner: 'A banner image file is required' });
  }
  const organization = await uploadOrgBannerService(req.user.id, req.file);
  res.status(200).json({ organization, message: 'Organization banner updated successfully' });
});

export const deleteOrgBannerController = asyncHandler(async (req, res) => {
  const organization = await removeOrgBannerService(req.user.id);
  res.status(200).json({ organization, message: 'Organization banner removed successfully' });
});

