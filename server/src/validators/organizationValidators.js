export function validateOrganizationUpdate(body = {}) {
  const errors = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 180) {
      errors.name = 'Organization name must be between 2 and 180 characters';
    }
  }

  if (body.slug !== undefined && body.slug !== null && String(body.slug).trim() !== '') {
    const slugStr = String(body.slug).trim().toLowerCase();
    if (!/^[a-z0-9-]+$/.test(slugStr) || slugStr.length < 3 || slugStr.length > 80) {
      errors.slug = 'Slug must be 3-80 lowercase alphanumeric characters and hyphens only (e.g. my-esports-org)';
    }
  }

  if (body.description !== undefined && body.description !== null && String(body.description).trim() !== '') {
    if (typeof body.description !== 'string' || body.description.length > 255) {
      errors.description = 'Description must not exceed 255 characters';
    }
  }

  if (body.about !== undefined && body.about !== null && String(body.about).trim() !== '') {
    if (typeof body.about !== 'string' || body.about.length > 3000) {
      errors.about = 'About text must not exceed 3000 characters';
    }
  }

  if (body.logoUrl !== undefined && body.logoUrl !== null && String(body.logoUrl).trim() !== '') {
    if (typeof body.logoUrl !== 'string' || body.logoUrl.length > 500) {
      errors.logoUrl = 'Logo URL must not exceed 500 characters';
    }
  }

  if (body.coverUrl !== undefined && body.coverUrl !== null && String(body.coverUrl).trim() !== '') {
    if (typeof body.coverUrl !== 'string' || body.coverUrl.length > 500) {
      errors.coverUrl = 'Cover URL must not exceed 500 characters';
    }
  }

  if (body.country !== undefined && body.country !== null && String(body.country).trim() !== '') {
    if (typeof body.country !== 'string' || body.country.length > 100) {
      errors.country = 'Country must not exceed 100 characters';
    }
  }

  if (body.city !== undefined && body.city !== null && String(body.city).trim() !== '') {
    if (typeof body.city !== 'string' || body.city.length > 100) {
      errors.city = 'City must not exceed 100 characters';
    }
  }

  if (body.foundedYear !== undefined && body.foundedYear !== null && String(body.foundedYear).trim() !== '') {
    const yr = Number(body.foundedYear);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(yr) || yr < 1970 || yr > currentYear + 1) {
      errors.foundedYear = `Founded year must be between 1970 and ${currentYear + 1}`;
    }
  }

  if (body.websiteUrl !== undefined && body.websiteUrl !== null && String(body.websiteUrl).trim() !== '') {
    if (typeof body.websiteUrl !== 'string' || body.websiteUrl.length > 255) {
      errors.websiteUrl = 'Website URL must not exceed 255 characters';
    }
  }

  if (body.discordUrl !== undefined && body.discordUrl !== null && String(body.discordUrl).trim() !== '') {
    if (typeof body.discordUrl !== 'string' || body.discordUrl.length > 255) {
      errors.discordUrl = 'Discord URL must not exceed 255 characters';
    }
  }

  if (body.twitterUrl !== undefined && body.twitterUrl !== null && String(body.twitterUrl).trim() !== '') {
    if (typeof body.twitterUrl !== 'string' || body.twitterUrl.length > 255) {
      errors.twitterUrl = 'Twitter URL must not exceed 255 characters';
    }
  }

  if (body.instagramUrl !== undefined && body.instagramUrl !== null && String(body.instagramUrl).trim() !== '') {
    if (typeof body.instagramUrl !== 'string' || body.instagramUrl.length > 255) {
      errors.instagramUrl = 'Instagram URL must not exceed 255 characters';
    }
  }

  return errors;
}
