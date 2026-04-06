const { ModeratorProfile, User } = require("../models");

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function normalizeString(value) {
  if (typeof value !== "string") {
    return null;
  }

  const trimmed = value.trim();
  return trimmed ? trimmed : null;
}

function normalizeNullableNumber(value, fieldName) {
  if (value === null || value === undefined || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue)) {
    throw createHttpError(400, `${fieldName} must be a valid number.`);
  }

  return numericValue;
}

function normalizeSkillArray(value) {
  if (value === null || value === undefined) {
    return [];
  }

  if (!Array.isArray(value)) {
    throw createHttpError(400, "skills must be an array of strings.");
  }

  return value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter(Boolean)
    .slice(0, 30);
}

function slugify(value) {
  return String(value || "")
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

async function getModeratorUserOrThrow(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }

  if (user.user_type !== "moderator") {
    throw createHttpError(403, "Only moderator accounts can manage moderator profiles.");
  }

  return user;
}

function profileStatusFromFlags(isPublished) {
  if (isPublished) {
    return "published";
  }

  return "draft";
}

function serializeProfile(profile) {
  return {
    id: profile._id,
    userId: profile.user_id,
    displayName: profile.display_name || "",
    headline: profile.headline || "",
    bio: profile.bio || "",
    yearsExperience: profile.years_experience ?? null,
    hourlyRateCents: profile.hourly_rate_cents ?? null,
    responseTimeMinutes: profile.response_time_minutes ?? null,
    averageRating: profile.average_rating ?? null,
    ratingCount: profile.rating_count ?? 0,
    skills: Array.isArray(profile.skills) ? profile.skills : [],
    availabilitySummary: profile.availability_summary || "",
    publicSlug: profile.public_slug || null,
    profileStatus: profile.profile_status || "draft",
    isPublished: profile.profile_status === "published",
    createdAt: profile.created_at || null,
    updatedAt: profile.updated_at || null,
  };
}

async function ensureUniqueSlug(baseSlug, profileId) {
  const normalizedBase = baseSlug || "moderator";
  let nextSlug = normalizedBase;
  let suffix = 1;

  while (true) {
    const existingProfile = await ModeratorProfile.findOne({ public_slug: nextSlug });

    if (!existingProfile || String(existingProfile._id) === String(profileId)) {
      return nextSlug;
    }

    suffix += 1;
    nextSlug = `${normalizedBase}-${suffix}`;
  }
}

function buildDefaultProfile(user) {
  const nameParts = [user.first_name, user.last_name].filter(Boolean);
  const displayName = nameParts.join(" ").trim() || "New Moderator";

  return {
    user_id: user._id,
    display_name: displayName,
    profile_status: "draft",
    skills: [],
    availability_summary: "",
    created_at: new Date(),
    updated_at: new Date(),
  };
}

async function getOrCreateModeratorProfile({ clerkUserId }) {
  const user = await getModeratorUserOrThrow(clerkUserId);

  let profile = await ModeratorProfile.findOne({ user_id: user._id });

  if (!profile) {
    profile = new ModeratorProfile(buildDefaultProfile(user));
    await profile.save();
  }

  return {
    profile: serializeProfile(profile),
  };
}

async function upsertModeratorProfile({ clerkUserId, payload }) {
  const user = await getModeratorUserOrThrow(clerkUserId);

  let profile = await ModeratorProfile.findOne({ user_id: user._id });

  if (!profile) {
    profile = new ModeratorProfile(buildDefaultProfile(user));
  }

  const displayName = normalizeString(payload.displayName);
  const headline = normalizeString(payload.headline);
  const bio = normalizeString(payload.bio);
  const availabilitySummary = normalizeString(payload.availabilitySummary);
  const skills = normalizeSkillArray(payload.skills);

  if (displayName) {
    profile.display_name = displayName;
  }

  if (headline !== null) {
    profile.headline = headline;
  }

  if (bio !== null) {
    profile.bio = bio;
  }

  profile.skills = skills;
  profile.availability_summary = availabilitySummary || "";

  const yearsExperience = normalizeNullableNumber(payload.yearsExperience, "yearsExperience");
  const hourlyRateCents = normalizeNullableNumber(payload.hourlyRateCents, "hourlyRateCents");
  const responseTimeMinutes = normalizeNullableNumber(payload.responseTimeMinutes, "responseTimeMinutes");

  if (yearsExperience !== null && yearsExperience < 0) {
    throw createHttpError(400, "yearsExperience cannot be negative.");
  }

  if (hourlyRateCents !== null && hourlyRateCents < 0) {
    throw createHttpError(400, "hourlyRateCents cannot be negative.");
  }

  if (responseTimeMinutes !== null && responseTimeMinutes < 0) {
    throw createHttpError(400, "responseTimeMinutes cannot be negative.");
  }

  profile.years_experience = yearsExperience;
  profile.hourly_rate_cents = hourlyRateCents;
  profile.response_time_minutes = responseTimeMinutes;

  const requestedIsPublished = payload.isPublished === true;
  profile.profile_status = profileStatusFromFlags(requestedIsPublished);

  const now = new Date();
  profile.updated_at = now;

  if (!profile.created_at) {
    profile.created_at = now;
  }

  if (requestedIsPublished) {
    const sourceName = profile.display_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || "moderator";
    const desiredSlug = slugify(sourceName);
    profile.public_slug = await ensureUniqueSlug(desiredSlug, profile._id);
  }

  await profile.save();

  return {
    profile: serializeProfile(profile),
  };
}

async function publishModeratorProfile({ clerkUserId }) {
  const user = await getModeratorUserOrThrow(clerkUserId);
  let profile = await ModeratorProfile.findOne({ user_id: user._id });

  if (!profile) {
    profile = new ModeratorProfile(buildDefaultProfile(user));
  }

  const baseName = profile.display_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || "moderator";
  const desiredSlug = slugify(baseName);

  profile.public_slug = await ensureUniqueSlug(desiredSlug, profile._id);
  profile.profile_status = "published";
  profile.updated_at = new Date();

  if (!profile.created_at) {
    profile.created_at = profile.updated_at;
  }

  await profile.save();

  return {
    profile: serializeProfile(profile),
  };
}

async function getPublicModeratorProfileBySlug({ slug }) {
  const normalizedSlug = normalizeString(slug);

  if (!normalizedSlug) {
    throw createHttpError(400, "A profile slug is required.");
  }

  const profile = await ModeratorProfile.findOne({
    public_slug: normalizedSlug,
    profile_status: "published",
  });

  if (!profile) {
    throw createHttpError(404, "Moderator profile not found.");
  }

  return {
    profile: serializeProfile(profile),
  };
}

module.exports = {
  getOrCreateModeratorProfile,
  getPublicModeratorProfileBySlug,
  publishModeratorProfile,
  upsertModeratorProfile,
};
