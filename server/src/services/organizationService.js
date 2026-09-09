import { errorResponses } from '../errors/AppError.js';
import {
  listPublicOrganizations,
  findPublicOrganizationByIdOrSlug,
  getOrganizationStatistics,
  getOrganizationTournaments,
  getOrganizationByOwnerId,
  updateOrganizationProfile,
} from '../repositories/organizationRepository.js';
import { pool } from '../config/database.js';
import { deleteMediaObject, replaceMediaObject } from './mediaService.js';

/**
 * Lists public organizations for discovery with live tournament counts.
 */
export async function getPublicOrganizations(options = {}) {
  return listPublicOrganizations(options);
}

/**
 * Retrieves public organization profile along with authoritative live statistics.
 */
export async function getPublicOrganizationProfile(idOrSlug) {
  const org = await findPublicOrganizationByIdOrSlug(idOrSlug);
  if (!org) {
    throw errorResponses.notFound('Organization not found');
  }

  const stats = await getOrganizationStatistics(org.id, org.ownerId);

  // Return public fields only (never expose password, payment keys, internal staff notes)
  return {
    id: org.id,
    name: org.name,
    slug: org.slug,
    description: org.description,
    about: org.about,
    logoUrl: org.logoUrl,
    coverUrl: org.coverUrl,
    country: org.country,
    city: org.city,
    foundedYear: org.foundedYear,
    websiteUrl: org.websiteUrl,
    discordUrl: org.discordUrl,
    twitterUrl: org.twitterUrl,
    instagramUrl: org.instagramUrl,
    verified: org.verified,
    createdAt: org.createdAt,
    stats,
  };
}

/**
 * Retrieves tournaments hosted by the organization.
 */
export async function getOrganizationTournamentsList(idOrSlug, options = {}) {
  const org = await findPublicOrganizationByIdOrSlug(idOrSlug);
  if (!org) {
    throw errorResponses.notFound('Organization not found');
  }

  return getOrganizationTournaments(org.id, org.ownerId, options);
}

/**
 * Retrieves organizer's own organization profile for management.
 */
export async function getMyOrganizationProfile(organizerUserId) {
  const org = await getOrganizationByOwnerId(organizerUserId);
  const stats = await getOrganizationStatistics(org.id, organizerUserId);
  return { ...org, stats };
}

/**
 * Updates organizer's own organization profile.
 */
export async function updateMyOrganizationProfile(organizerUserId, updates) {
  const org = await getOrganizationByOwnerId(organizerUserId);
  if (!org) {
    throw errorResponses.notFound('Organization not found');
  }

  // If slug is updated, check uniqueness
  if (updates.slug && updates.slug.trim() && updates.slug !== org.slug) {
    const cleanSlug = updates.slug.trim().toLowerCase();
    const [existing] = await pool.query(
      'SELECT id FROM organizations WHERE slug = ? AND id <> ? LIMIT 1',
      [cleanSlug, org.id],
    );
    if (existing.length > 0) {
      throw errorResponses.conflict('Organization slug is already taken. Please choose another.');
    }
    updates.slug = cleanSlug;
  }

  await updateOrganizationProfile(org.id, updates);
  return getMyOrganizationProfile(organizerUserId);
}

export async function uploadOrgLogoService(organizerUserId, file) {
  const org = await getOrganizationByOwnerId(organizerUserId);
  if (!org) throw errorResponses.notFound('Organization not found');

  const media = await replaceMediaObject({
    oldKeyOrUrl: org.logoUrl,
    newFile: file,
    category: 'organizations',
    entityId: org.id,
    type: 'logo',
  });

  await updateOrganizationProfile(org.id, { logoUrl: media.url });
  return getMyOrganizationProfile(organizerUserId);
}

export async function removeOrgLogoService(organizerUserId) {
  const org = await getOrganizationByOwnerId(organizerUserId);
  if (!org) throw errorResponses.notFound('Organization not found');

  if (org.logoUrl) {
    await deleteMediaObject(org.logoUrl).catch(() => {});
    await updateOrganizationProfile(org.id, { logoUrl: null });
  }

  return getMyOrganizationProfile(organizerUserId);
}

export async function uploadOrgBannerService(organizerUserId, file) {
  const org = await getOrganizationByOwnerId(organizerUserId);
  if (!org) throw errorResponses.notFound('Organization not found');

  const media = await replaceMediaObject({
    oldKeyOrUrl: org.coverUrl,
    newFile: file,
    category: 'organizations',
    entityId: org.id,
    type: 'banner',
  });

  await updateOrganizationProfile(org.id, { coverUrl: media.url });
  return getMyOrganizationProfile(organizerUserId);
}

export async function removeOrgBannerService(organizerUserId) {
  const org = await getOrganizationByOwnerId(organizerUserId);
  if (!org) throw errorResponses.notFound('Organization not found');

  if (org.coverUrl) {
    await deleteMediaObject(org.coverUrl).catch(() => {});
    await updateOrganizationProfile(org.id, { coverUrl: null });
  }

  return getMyOrganizationProfile(organizerUserId);
}

