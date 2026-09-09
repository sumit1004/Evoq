export function validateOrganizationUpdate(body = {}) {
  const errors = {};

  if (body.name !== undefined) {
    if (typeof body.name !== 'string' || body.name.trim().length < 2 || body.name.trim().length > 180) {
      errors.name = 'Organization name must be between 2 and 180 characters';
    }
  }

  if (body.slug !== undefined && body.slug !== null && body.slug !== '') {
    if (typeof body.slug !== 'string' || !/^[a-z0-9-]+$/.test(body.slug) || body.slug.length < 3 || body.slug.length > 80) {
      errors.slug = 'Slug must be 3-80 lowercase alphanumeric characters and hyphens only';
    }
  }

  if (body.description !== undefined && body.description !== null) {
    if (typeof body.description !== 'string' || body.description.length > 255) {
      errors.description = 'Description must not exceed 255 characters';
    }
  }

  if (body.about !== undefined && body.about !== null) {
    if (typeof body.about !== 'string' || body.about.length > 3000) {
      errors.about = 'About text must not exceed 3000 characters';
    }
  }

  if (body.logoUrl !== undefined && body.logoUrl !== null && body.logoUrl !== '') {
    if (typeof body.logoUrl !== 'string' || body.logoUrl.length > 500) {
      errors.logoUrl = 'Logo URL must not exceed 500 characters';
    }
  }

  if (body.coverUrl !== undefined && body.coverUrl !== null && body.coverUrl !== '') {
    if (typeof body.coverUrl !== 'string' || body.coverUrl.length > 500) {
      errors.coverUrl = 'Cover URL must not exceed 500 characters';
    }
  }

  if (body.country !== undefined && body.country !== null) {
    if (typeof body.country !== 'string' || body.country.length > 100) {
      errors.country = 'Country must not exceed 100 characters';
    }
  }

  if (body.city !== undefined && body.city !== null) {
    if (typeof body.city !== 'string' || body.city.length > 100) {
      errors.city = 'City must not exceed 100 characters';
    }
  }

  if (body.foundedYear !== undefined && body.foundedYear !== null && body.foundedYear !== '') {
    const yr = Number(body.foundedYear);
    const currentYear = new Date().getFullYear();
    if (!Number.isInteger(yr) || yr < 1970 || yr > currentYear) {
      errors.foundedYear = `Founded year must be between 1970 and ${currentYear}`;
    }
  }

  if (body.websiteUrl !== undefined && body.websiteUrl !== null && body.websiteUrl !== '') {
    if (typeof body.websiteUrl !== 'string' || body.websiteUrl.length > 255) {
      errors.websiteUrl = 'Website URL must not exceed 255 characters';
    }
  }

  if (body.discordUrl !== undefined && body.discordUrl !== null && body.discordUrl !== '') {
    if (typeof body.discordUrl !== 'string' || body.discordUrl.length > 255) {
      errors.discordUrl = 'Discord URL must not exceed 255 characters';
    }
  }

  if (body.twitterUrl !== undefined && body.twitterUrl !== null && body.twitterUrl !== '') {
    if (typeof body.twitterUrl !== 'string' || body.twitterUrl.length > 255) {
      errors.twitterUrl = 'Twitter URL must not exceed 255 characters';
    }
  }

  if (body.instagramUrl !== undefined && body.instagramUrl !== null && body.instagramUrl !== '') {
    if (typeof body.instagramUrl !== 'string' || body.instagramUrl.length > 255) {
      errors.instagramUrl = 'Instagram URL must not exceed 255 characters';
    }
  }

  return errors;
}
