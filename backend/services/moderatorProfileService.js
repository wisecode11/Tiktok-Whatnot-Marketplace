const {
  ModeratorBooking,
  ModeratorOrderReview,
  ModeratorProfile,
  ModeratorSchedule,
  User,
} = require("../models");

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

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
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

function normalizeOptionalNonNegativeNumber(value, fieldName) {
  if (value === undefined || value === null || value === "") {
    return null;
  }

  const numericValue = Number(value);

  if (!Number.isFinite(numericValue) || numericValue < 0) {
    throw createHttpError(400, `${fieldName} must be a non-negative number.`);
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

function serializePublicProfile(profile, availability) {
  return {
    ...serializeProfile(profile),
    availability,
  };
}

function roundRating(value) {
  if (!Number.isFinite(value)) {
    return null;
  }

  return Math.round(value * 10) / 10;
}

function applyReviewStatsToProfile(profile, stats) {
  const ratingCount = Number(stats?.ratingCount || 0);
  const averageRating = ratingCount > 0 ? roundRating(Number(stats?.averageRating || 0)) : null;

  return {
    ...profile,
    averageRating,
    ratingCount,
  };
}

function formatReviewerName(user) {
  if (!user) {
    return "Anonymous buyer";
  }

  const firstName = normalizeString(user.first_name);
  const lastName = normalizeString(user.last_name);

  if (firstName && lastName) {
    return `${firstName} ${lastName.charAt(0)}.`;
  }

  if (firstName) {
    return firstName;
  }

  if (user.email) {
    return String(user.email).split("@")[0] || "Anonymous buyer";
  }

  return "Anonymous buyer";
}

function serializePublicReview(review, reviewerName) {
  return {
    id: review._id,
    bookingId: review.booking_id,
    rating: review.rating,
    reviewText: review.review_text || "",
    reviewerName,
    createdAt: review.created_at || null,
  };
}

async function getReviewStatsByModeratorUserIds(moderatorUserIds = []) {
  const normalizedIds = Array.from(new Set((moderatorUserIds || []).map((id) => String(id)).filter(Boolean)));

  if (!normalizedIds.length) {
    return new Map();
  }

  const stats = await ModeratorOrderReview.aggregate([
    {
      $match: {
        moderator_user_id: { $in: normalizedIds },
        is_public: true,
      },
    },
    {
      $group: {
        _id: "$moderator_user_id",
        averageRating: { $avg: "$rating" },
        ratingCount: { $sum: 1 },
      },
    },
  ]);

  return new Map(stats.map((entry) => [String(entry._id), entry]));
}

async function getPublicReviewsForModeratorUserId(moderatorUserId, limit = 10) {
  const normalizedUserId = normalizeString(moderatorUserId);

  if (!normalizedUserId) {
    return [];
  }

  const reviews = await ModeratorOrderReview.find({
    moderator_user_id: normalizedUserId,
    is_public: true,
  })
    .sort({ created_at: -1 })
    .limit(limit)
    .lean();

  if (!reviews.length) {
    return [];
  }

  const reviewerUserIds = Array.from(
    new Set(reviews.map((review) => String(review.streamer_user_id)).filter(Boolean))
  );

  const reviewerUsers = await User.find(
    { _id: { $in: reviewerUserIds } },
    { first_name: 1, last_name: 1, email: 1 }
  ).lean();

  const reviewerById = new Map(reviewerUsers.map((user) => [String(user._id), user]));

  return reviews.map((review) => {
    const reviewer = reviewerById.get(String(review.streamer_user_id));
    return serializePublicReview(review, formatReviewerName(reviewer));
  });
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

const WEEKLY_DAY_CODES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"];

function normalizeTimeValue(value, fieldName) {
  if (typeof value !== "string") {
    throw createHttpError(400, `${fieldName} must be a string in HH:MM format.`);
  }

  const trimmed = value.trim();

  if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(trimmed)) {
    throw createHttpError(400, `${fieldName} must match HH:MM 24-hour format.`);
  }

  return trimmed;
}

function normalizeDayOfWeek(value, fieldName) {
  const numeric = Number(value);

  if (!Number.isInteger(numeric) || numeric < 0 || numeric > 6) {
    throw createHttpError(400, `${fieldName} must be an integer between 0 and 6.`);
  }

  return numeric;
}

function normalizeHolidayDate(value) {
  if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw createHttpError(400, "holidays must contain dates in YYYY-MM-DD format.");
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);

  if (Number.isNaN(parsed.getTime()) || parsed.toISOString().slice(0, 10) !== value) {
    throw createHttpError(400, "holidays contains an invalid calendar date.");
  }

  return parsed.toISOString().slice(0, 10);
}

function normalizeIsoDateTime(value, fieldName) {
  if (typeof value !== "string" || !/(Z|[+-]\d{2}:\d{2})$/i.test(value.trim())) {
    throw createHttpError(400, `${fieldName} must include timezone offset (for example, 2026-04-06T12:00:00Z).`);
  }

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    throw createHttpError(400, `${fieldName} must be a valid ISO date-time.`);
  }

  // Date is stored in UTC in MongoDB. Returning a Date object keeps that behavior.
  return new Date(parsed.toISOString());
}

function normalizeAvailabilityPayload(payload = {}) {
  const timezone = normalizeString(payload.timezone) || "UTC";
  const weeklyInput = Array.isArray(payload.weekly) ? payload.weekly : [];
  const breaksInput = Array.isArray(payload.breaks) ? payload.breaks : [];
  const holidaysInput = Array.isArray(payload.holidays) ? payload.holidays : [];
  const timeOffRangesInput = Array.isArray(payload.timeOffRanges) ? payload.timeOffRanges : [];

  const weekly = weeklyInput.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw createHttpError(400, `weekly[${index}] must be an object.`);
    }

    const dayOfWeek = normalizeDayOfWeek(entry.dayOfWeek, `weekly[${index}].dayOfWeek`);
    const isAvailable = entry.isAvailable === true;
    const startTime = normalizeTimeValue(entry.startTime || "09:00", `weekly[${index}].startTime`);
    const endTime = normalizeTimeValue(entry.endTime || "17:00", `weekly[${index}].endTime`);

    if (startTime >= endTime) {
      throw createHttpError(400, `weekly[${index}] startTime must be before endTime.`);
    }

    return { dayOfWeek, isAvailable, startTime, endTime };
  });

  const breaks = breaksInput.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw createHttpError(400, `breaks[${index}] must be an object.`);
    }

    const dayOfWeek = normalizeDayOfWeek(entry.dayOfWeek, `breaks[${index}].dayOfWeek`);
    const startTime = normalizeTimeValue(entry.startTime, `breaks[${index}].startTime`);
    const endTime = normalizeTimeValue(entry.endTime, `breaks[${index}].endTime`);

    if (startTime >= endTime) {
      throw createHttpError(400, `breaks[${index}] startTime must be before endTime.`);
    }

    return { dayOfWeek, startTime, endTime };
  });

  const holidays = Array.from(new Set(holidaysInput.map(normalizeHolidayDate))).sort();

  const timeOffRanges = timeOffRangesInput.map((entry, index) => {
    if (!entry || typeof entry !== "object") {
      throw createHttpError(400, `timeOffRanges[${index}] must be an object.`);
    }

    const startAt = normalizeIsoDateTime(entry.startAt, `timeOffRanges[${index}].startAt`);
    const endAt = normalizeIsoDateTime(entry.endAt, `timeOffRanges[${index}].endAt`);

    if (endAt <= startAt) {
      throw createHttpError(400, `timeOffRanges[${index}] endAt must be after startAt.`);
    }

    const reason = normalizeString(entry.reason) || "time-off";
    return { startAt, endAt, reason };
  });

  return {
    timezone,
    weekly,
    breaks,
    holidays,
    timeOffRanges,
  };
}

function serializeAvailability(schedule) {
  if (!schedule) {
    return {
      timezone: "UTC",
      weekly: WEEKLY_DAY_CODES.map((_, dayOfWeek) => ({
        dayOfWeek,
        isAvailable: false,
        startTime: "09:00",
        endTime: "17:00",
        breaks: [],
      })),
      holidays: [],
      timeOffRanges: [],
    };
  }

  // Build a map for quick lookup
  const dayMap = new Map(
    (schedule.weekly_schedule || []).map((entry) => [entry.day_of_week, entry])
  );

  const weekly = WEEKLY_DAY_CODES.map((_, dayOfWeek) => {
    const day = dayMap.get(dayOfWeek);
    return {
      dayOfWeek,
      isAvailable: day ? Boolean(day.is_available) : false,
      startTime: day?.start_time || "09:00",
      endTime: day?.end_time || "17:00",
      breaks: (day?.breaks || []).map((br) => ({
        startTime: br.start_time,
        endTime: br.end_time,
      })),
    };
  });

  const holidays = (schedule.holidays || []).slice().sort();

  const timeOffRanges = (schedule.time_off_ranges || [])
    .map((entry) => ({
      startAt: entry.start_at,
      endAt: entry.end_at,
      reason: entry.reason || "time-off",
    }))
    .sort((first, second) => new Date(first.startAt) - new Date(second.startAt));

  return {
    timezone: schedule.timezone || "UTC",
    weekly,
    holidays,
    timeOffRanges,
  };
}

async function getOrCreateProfileForUser(user) {
  let profile = await ModeratorProfile.findOne({ user_id: user._id });

  if (!profile) {
    profile = new ModeratorProfile(buildDefaultProfile(user));
    await profile.save();
  }

  return profile;
}

async function applyProfilePayload({ profile, user, payload = {}, shouldPublish = false }) {
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

  if (shouldPublish) {
    const sourceName = profile.display_name || [user.first_name, user.last_name].filter(Boolean).join(" ") || "moderator";
    const desiredSlug = slugify(sourceName);
    profile.public_slug = await ensureUniqueSlug(desiredSlug, profile._id);
    profile.profile_status = "published";
  }

  const now = new Date();
  profile.updated_at = now;

  if (!profile.created_at) {
    profile.created_at = now;
  }

  return profile;
}

async function getOrCreateModeratorProfile({ clerkUserId }) {
  const user = await getModeratorUserOrThrow(clerkUserId);
  const profile = await getOrCreateProfileForUser(user);

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

  const requestedIsPublished = payload.isPublished === true;
  await applyProfilePayload({
    profile,
    user,
    payload,
    shouldPublish: requestedIsPublished,
  });

  if (!requestedIsPublished) {
    profile.profile_status = profileStatusFromFlags(false);
  }

  await profile.save();

  return {
    profile: serializeProfile(profile),
  };
}

async function publishModeratorProfile({ clerkUserId, payload = {} }) {
  const user = await getModeratorUserOrThrow(clerkUserId);
  let profile = await ModeratorProfile.findOne({ user_id: user._id });

  if (!profile) {
    profile = new ModeratorProfile(buildDefaultProfile(user));
  }

  await applyProfilePayload({
    profile,
    user,
    payload,
    shouldPublish: true,
  });

  await profile.save();

  return {
    profile: serializeProfile(profile),
  };
}

async function getModeratorAvailability({ clerkUserId }) {
  const user = await getModeratorUserOrThrow(clerkUserId);
  const profile = await getOrCreateProfileForUser(user);

  const schedule = await ModeratorSchedule.findOne({ moderator_profile_id: profile._id });

  return {
    availability: serializeAvailability(schedule),
  };
}

async function upsertModeratorAvailability({ clerkUserId, payload = {} }) {
  const user = await getModeratorUserOrThrow(clerkUserId);
  const profile = await getOrCreateProfileForUser(user);
  const normalized = normalizeAvailabilityPayload(payload);
  const now = new Date();

  // Build the breaks lookup: { [dayOfWeek]: [{ start_time, end_time }, ...] }
  const breaksByDay = {};
  for (const breakEntry of normalized.breaks) {
    if (!breaksByDay[breakEntry.dayOfWeek]) {
      breaksByDay[breakEntry.dayOfWeek] = [];
    }
    breaksByDay[breakEntry.dayOfWeek].push({
      start_time: breakEntry.startTime,
      end_time: breakEntry.endTime,
    });
  }

  // Build the 7-element weekly_schedule array with breaks embedded per day
  const weekly_schedule = normalized.weekly.map((entry) => ({
    day_of_week: entry.dayOfWeek,
    is_available: entry.isAvailable,
    start_time: entry.startTime,
    end_time: entry.endTime,
    breaks: breaksByDay[entry.dayOfWeek] || [],
  }));

  const time_off_ranges = normalized.timeOffRanges.map((entry) => ({
    start_at: entry.startAt,
    end_at: entry.endAt,
    reason: entry.reason,
  }));

  // Upsert — one document per moderator profile (findOneAndUpdate with upsert)
  const schedule = await ModeratorSchedule.findOneAndUpdate(
    { moderator_profile_id: profile._id },
    {
      $set: {
        timezone: normalized.timezone,
        weekly_schedule,
        holidays: normalized.holidays,
        time_off_ranges,
        updated_at: now,
      },
      $setOnInsert: { created_at: now },
    },
    { upsert: true, new: true }
  );

  return {
    availability: serializeAvailability(schedule),
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

  const [schedule, reviewStatsByUserId, reviews] = await Promise.all([
    ModeratorSchedule.findOne({ moderator_profile_id: profile._id }),
    getReviewStatsByModeratorUserIds([profile.user_id]),
    getPublicReviewsForModeratorUserId(profile.user_id, 12),
  ]);

  const reviewStats = reviewStatsByUserId.get(String(profile.user_id));

  return {
    profile: {
      ...applyReviewStatsToProfile(
        serializePublicProfile(profile, serializeAvailability(schedule)),
        reviewStats
      ),
      reviews,
    },
  };
}

async function getPublicModeratorProfileByUserId({ userId }) {
  const normalizedUserId = normalizeString(userId);

  if (!normalizedUserId) {
    throw createHttpError(400, "A userId is required.");
  }

  const user = await User.findOne({
    _id: normalizedUserId,
    user_type: "moderator",
    status: { $ne: "deleted" },
  });

  if (!user) {
    throw createHttpError(404, "Moderator not found.");
  }

  const profile = await ModeratorProfile.findOne({ user_id: user._id });

  if (!profile) {
    const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
      || (user.email ? String(user.email).split("@")[0] : "Moderator");

    const [reviewStatsByUserId, reviews] = await Promise.all([
      getReviewStatsByModeratorUserIds([user._id]),
      getPublicReviewsForModeratorUserId(user._id, 12),
    ]);
    const reviewStats = reviewStatsByUserId.get(String(user._id));
    const ratingCount = Number(reviewStats?.ratingCount || 0);

    return {
      profile: {
        id: user._id,
        userId: user._id,
        displayName,
        headline: "",
        bio: "",
        yearsExperience: null,
        hourlyRateCents: null,
        responseTimeMinutes: null,
        averageRating: ratingCount > 0 ? roundRating(Number(reviewStats?.averageRating || 0)) : null,
        ratingCount,
        skills: [],
        availabilitySummary: "",
        publicSlug: null,
        profileStatus: "draft",
        isPublished: false,
        createdAt: user.created_at || null,
        updatedAt: user.updated_at || null,
        availability: serializeAvailability(null),
        reviews,
      },
    };
  }

  const [schedule, reviewStatsByUserId, reviews] = await Promise.all([
    ModeratorSchedule.findOne({ moderator_profile_id: profile._id }),
    getReviewStatsByModeratorUserIds([profile.user_id]),
    getPublicReviewsForModeratorUserId(profile.user_id, 12),
  ]);
  const reviewStats = reviewStatsByUserId.get(String(profile.user_id));

  return {
    profile: {
      ...applyReviewStatsToProfile(
        serializePublicProfile(profile, serializeAvailability(schedule)),
        reviewStats
      ),
      reviews,
    },
  };
}

/**
 * Parse "HH:MM" time string into total minutes since midnight.
 */
function timeToMinutes(timeStr) {
  if (!timeStr || typeof timeStr !== "string") return 0;
  const [hStr, mStr] = timeStr.split(":");
  return Number(hStr) * 60 + Number(mStr);
}

/**
 * Check whether a requested [slotStart, slotEnd) time window falls within
 * a moderator's weekly working hours for the given day AND is not blocked
 * by any break.
 *
 * @param {object} daySchedule  – one entry from ModeratorSchedule.weekly_schedule
 * @param {string} slotStart    – "HH:MM"
 * @param {string} slotEnd      – "HH:MM"
 * @returns {boolean}
 */
function slotFitsInDaySchedule(daySchedule, slotStart, slotEnd) {
  if (!daySchedule || !daySchedule.is_available) return false;

  const workStart = timeToMinutes(daySchedule.start_time);
  const workEnd   = timeToMinutes(daySchedule.end_time);
  const reqStart  = timeToMinutes(slotStart);
  const reqEnd    = timeToMinutes(slotEnd);

  // Requested slot must fit completely within working window.
  if (reqStart < workStart || reqEnd > workEnd) return false;

  // Slot must not overlap any break.
  for (const br of (daySchedule.breaks || [])) {
    const brStart = timeToMinutes(br.start_time);
    const brEnd   = timeToMinutes(br.end_time);
    // Overlap test: slot starts before break ends AND slot ends after break starts
    if (reqStart < brEnd && reqEnd > brStart) return false;
  }

  return true;
}

/**
 * Given a schedule document and a requested date+slot, return true if the
 * moderator is actually available (weekly rules, holidays, time-off ranges
 * all satisfied).
 *
 * @param {object} schedule    – ModeratorSchedule mongoose document (may be null)
 * @param {Date}   slotStartDt – JS Date representing the start of the requested slot (UTC)
 * @param {Date}   slotEndDt   – JS Date representing the end   of the requested slot (UTC)
 * @param {string} dateStr     – "YYYY-MM-DD" in the moderator's local timezone (used for holiday check)
 * @returns {boolean}
 */
function isModeratorAvailableForSlot(schedule, slotStartDt, slotEndDt, dateStr) {
  if (!schedule) return false;

  // 1. Holiday check (full-day blackout stored as YYYY-MM-DD strings)
  if ((schedule.holidays || []).includes(dateStr)) return false;

  // 2. Time-off range check
  for (const range of (schedule.time_off_ranges || [])) {
    const rangeStart = new Date(range.start_at);
    const rangeEnd   = new Date(range.end_at);
    // If the requested slot overlaps the time-off range at all → not available
    if (slotStartDt < rangeEnd && slotEndDt > rangeStart) return false;
  }

  // 3. Weekly schedule check
  // Use the day-of-week of the requested slot start in UTC (caller should pass
  // the correct date/time already adjusted for the moderator's timezone before
  // constructing slotStartDt, OR we compare in UTC which is an acceptable
  // approximation for date-based filtering).
  const dayOfWeek = slotStartDt.getUTCDay(); // 0 = Sunday … 6 = Saturday

  const daySchedule = (schedule.weekly_schedule || []).find(
    (entry) => entry.day_of_week === dayOfWeek
  );

  // Derive HH:MM from the UTC date for slot-within-day comparison
  const slotStartTime = `${String(slotStartDt.getUTCHours()).padStart(2, "0")}:${String(slotStartDt.getUTCMinutes()).padStart(2, "0")}`;
  const slotEndTime   = `${String(slotEndDt.getUTCHours()).padStart(2, "0")}:${String(slotEndDt.getUTCMinutes()).padStart(2, "0")}`;

  return slotFitsInDaySchedule(daySchedule, slotStartTime, slotEndTime);
}

async function listPublicModerators({ query = {} }) {
  const search = normalizeString(query.search);
  const skillList = String(query.skills || "")
    .split(",")
    .map((skill) => skill.trim())
    .filter(Boolean)
    .slice(0, 20);
  const minExperience = normalizeOptionalNonNegativeNumber(
    query.minExperience,
    "minExperience"
  );
  const minRating = normalizeOptionalNonNegativeNumber(query.minRating, "minRating");

  if (minRating !== null && minRating > 5) {
    throw createHttpError(400, "minRating must be less than or equal to 5.");
  }

  // ── Date / time slot filter (new) ─────────────────────────────────────────
  // Expects query.date = "YYYY-MM-DD" and query.startTime + query.endTime = "HH:MM"
  // All three must be present for slot-based filtering to activate.
  // Times are treated as UTC (or the same timezone used when saving availability).
  const dateStr      = normalizeString(query.date);       // "YYYY-MM-DD"
  const startTimeStr = normalizeString(query.startTime);  // "HH:MM"
  const endTimeStr   = normalizeString(query.endTime);    // "HH:MM"

  const hasSlotFilter = Boolean(dateStr && startTimeStr && endTimeStr);

  let slotStartDt = null;
  let slotEndDt   = null;

  if (hasSlotFilter) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
      throw createHttpError(400, "date must be in YYYY-MM-DD format.");
    }
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(startTimeStr)) {
      throw createHttpError(400, "startTime must be in HH:MM format.");
    }
    if (!/^([01]\d|2[0-3]):([0-5]\d)$/.test(endTimeStr)) {
      throw createHttpError(400, "endTime must be in HH:MM format.");
    }
    if (startTimeStr >= endTimeStr) {
      throw createHttpError(400, "startTime must be before endTime.");
    }

    slotStartDt = new Date(`${dateStr}T${startTimeStr}:00.000Z`);
    slotEndDt   = new Date(`${dateStr}T${endTimeStr}:00.000Z`);

    if (Number.isNaN(slotStartDt.getTime()) || Number.isNaN(slotEndDt.getTime())) {
      throw createHttpError(400, "Invalid date or time value.");
    }
  }
  // ──────────────────────────────────────────────────────────────────────────

  const users = await User.find({
    user_type: "moderator",
    status: { $ne: "deleted" },
  })
    .sort({ created_at: -1 })
    .limit(200);

  const userIds = users.map((user) => user._id);
  const profiles = await ModeratorProfile.find({ user_id: { $in: userIds } });
  const profileByUserId = new Map(profiles.map((profile) => [String(profile.user_id), profile]));
  const reviewStatsByUserId = await getReviewStatsByModeratorUserIds(userIds);

  // ── Pre-load schedules and booked-user-ids when slot filter is active ─────
  let bookedUserIdSet = new Set();
  let scheduleByProfileId = new Map();

  if (hasSlotFilter) {
    const profileIds = profiles.map((p) => p._id);

    // Load all schedules for these moderators in one query
    const schedules = await ModeratorSchedule.find({
      moderator_profile_id: { $in: profileIds },
    });
    scheduleByProfileId = new Map(
      schedules.map((s) => [String(s.moderator_profile_id), s])
    );

    // Find moderator_user_ids that have an active booking overlapping the slot.
    // Active = not cancelled / refunded / failed.
    const overlappingBookings = await ModeratorBooking.find({
      moderator_user_id: { $in: userIds },
      status: { $nin: ["cancelled", "refunded"] },
      payment_status: { $nin: ["failed"] },
      // Overlap condition: booking.start < slotEnd AND booking.end > slotStart
      scheduled_start_at: { $lt: slotEndDt },
      scheduled_end_at:   { $gt: slotStartDt },
    }).select("moderator_user_id");

    bookedUserIdSet = new Set(overlappingBookings.map((b) => String(b.moderator_user_id)));
  }
  // ──────────────────────────────────────────────────────────────────────────

  const normalizedSkillSet = new Set(skillList.map((skill) => skill.toLowerCase()));
  const searchRegex = search ? new RegExp(escapeRegex(search), "i") : null;

  const moderators = users
    .map((user) => {
      const profile = profileByUserId.get(String(user._id));
      const reviewStats = reviewStatsByUserId.get(String(user._id));

      if (profile) {
        return applyReviewStatsToProfile(serializeProfile(profile), reviewStats);
      }

      const displayName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim()
        || (user.email ? String(user.email).split("@")[0] : "Moderator");

      return applyReviewStatsToProfile({
        id: user._id,
        userId: user._id,
        displayName,
        headline: "",
        bio: "",
        yearsExperience: null,
        hourlyRateCents: null,
        responseTimeMinutes: null,
        averageRating: null,
        ratingCount: 0,
        skills: [],
        availabilitySummary: "",
        publicSlug: null,
        profileStatus: "draft",
        isPublished: false,
        createdAt: user.created_at || null,
        updatedAt: user.updated_at || null,
      }, reviewStats);
    })
    .filter((profile) => {
      // ── Slot-based availability filter ──────────────────────────────────
      if (hasSlotFilter) {
        // Reject if already booked for this slot
        if (bookedUserIdSet.has(String(profile.userId))) return false;

        // Reject if schedule says not available
        const scheduleDoc = scheduleByProfileId.get(String(profile.id));
        if (!isModeratorAvailableForSlot(scheduleDoc, slotStartDt, slotEndDt, dateStr)) {
          return false;
        }
      }
      // ────────────────────────────────────────────────────────────────────

      if (normalizedSkillSet.size > 0) {
        const skills = Array.isArray(profile.skills)
          ? profile.skills.map((skill) => String(skill).toLowerCase())
          : [];

        const hasSkill = skills.some((skill) => normalizedSkillSet.has(skill));
        if (!hasSkill) {
          return false;
        }
      }

      if (minExperience !== null) {
        if (profile.yearsExperience === null || profile.yearsExperience < minExperience) {
          return false;
        }
      }

      if (minRating !== null) {
        if (profile.averageRating === null || profile.averageRating < minRating) {
          return false;
        }
      }

      if (searchRegex) {
        const searchableValues = [
          profile.displayName,
          profile.headline,
          profile.bio,
          ...(Array.isArray(profile.skills) ? profile.skills : []),
        ].filter(Boolean);

        const matchesSearch = searchableValues.some((value) => searchRegex.test(String(value)));
        if (!matchesSearch) {
          return false;
        }
      }

      return true;
    })
    .sort((first, second) => {
      const firstPublished = first.profileStatus === "published" ? 1 : 0;
      const secondPublished = second.profileStatus === "published" ? 1 : 0;
      if (firstPublished !== secondPublished) {
        return secondPublished - firstPublished;
      }

      const firstRating = first.averageRating || 0;
      const secondRating = second.averageRating || 0;
      if (firstRating !== secondRating) {
        return secondRating - firstRating;
      }

      return new Date(second.createdAt || 0) - new Date(first.createdAt || 0);
    })
    .slice(0, 100);

  return {
    moderators,
    ...(hasSlotFilter ? { filteredBySlot: true, date: dateStr, startTime: startTimeStr, endTime: endTimeStr } : {}),
  };
}

module.exports = {
  getModeratorAvailability,
  getOrCreateModeratorProfile,
  getPublicModeratorProfileBySlug,
  getPublicModeratorProfileByUserId,
  listPublicModerators,
  publishModeratorProfile,
  upsertModeratorAvailability,
  upsertModeratorProfile,
};
