// services/platformSettingsService.js
// Read and update the singleton platform settings document (platform fee
// percent, admin Stripe Connect account information used to receive
// moderator-booking platform fees, etc.).

const PlatformSetting = require("../models/PlatformSetting");
const User = require("../models/Users");

const DEFAULT_PLATFORM_FEE_PERCENT = 15;
const DEFAULT_PLATFORM_FEE_BASIS_POINTS = 1500; // 15.00% → 1500 bps (1 bp = 0.01%)
const MIN_PLATFORM_FEE_PERCENT = 0;
const MAX_PLATFORM_FEE_PERCENT = 100;
const MAX_PLATFORM_FEE_BASIS_POINTS = 10000; // 100.00%

function percentToBasisPoints(percent) {
  const n = Number(percent);
  if (!Number.isFinite(n)) return DEFAULT_PLATFORM_FEE_BASIS_POINTS;
  const bps = Math.round(n * 100);
  return Math.min(MAX_PLATFORM_FEE_BASIS_POINTS, Math.max(0, bps));
}

function basisPointsToPercent(bps) {
  const n = Number(bps);
  if (!Number.isFinite(n)) return DEFAULT_PLATFORM_FEE_PERCENT;
  return Math.min(MAX_PLATFORM_FEE_PERCENT, Math.max(MIN_PLATFORM_FEE_PERCENT, Math.round((n / 100) * 100) / 100));
}

/**
 * Keep platform_fee_basis_points in sync with platform_fee_percent for reads/writes.
 */
async function ensurePlatformFeeBasisPoints(setting) {
  if (!setting) return;

  const percent =
    typeof setting.platform_fee_percent === "number"
      ? setting.platform_fee_percent
      : DEFAULT_PLATFORM_FEE_PERCENT;
  const expectedBps = percentToBasisPoints(percent);

  if (
    setting.platform_fee_basis_points == null
    || Number(setting.platform_fee_basis_points) !== expectedBps
  ) {
    setting.platform_fee_basis_points = expectedBps;
    setting.updated_at = new Date();
    await setting.save();
  }
}

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  if (details) error.details = details;
  return error;
}

async function getOrCreatePlatformSetting() {
  let setting = await PlatformSetting.findOne({ scope: "global" });

  if (!setting) {
    const now = new Date();
    setting = new PlatformSetting({
      scope: "global",
      platform_fee_percent: DEFAULT_PLATFORM_FEE_PERCENT,
      platform_fee_basis_points: DEFAULT_PLATFORM_FEE_BASIS_POINTS,
      created_at: now,
      updated_at: now,
    });
    await setting.save();
  }

  await ensurePlatformFeeBasisPoints(setting);

  return setting;
}

function serializePlatformSetting(setting) {
  if (!setting) {
    return {
      platformFeePercent: DEFAULT_PLATFORM_FEE_PERCENT,
      platformFeeBasisPoints: DEFAULT_PLATFORM_FEE_BASIS_POINTS,
      adminStripeAccount: null,
    };
  }

  const percent =
    typeof setting.platform_fee_percent === "number"
      ? setting.platform_fee_percent
      : DEFAULT_PLATFORM_FEE_PERCENT;
  const basisPoints =
    typeof setting.platform_fee_basis_points === "number"
      ? setting.platform_fee_basis_points
      : percentToBasisPoints(percent);

  return {
    platformFeePercent: percent,
    platformFeeBasisPoints: basisPoints,
    adminStripeAccount: setting.admin_stripe_account_id
      ? {
          stripeAccountId: setting.admin_stripe_account_id,
          chargesEnabled: Boolean(setting.admin_stripe_charges_enabled),
          payoutsEnabled: Boolean(setting.admin_stripe_payouts_enabled),
          detailsSubmitted: Boolean(setting.admin_stripe_details_submitted),
          onboardingStatus: setting.admin_stripe_onboarding_status || null,
          connectedUserId: setting.admin_stripe_connected_user_id || null,
        }
      : null,
  };
}

async function getPlatformFeeFraction() {
  const setting = await getOrCreatePlatformSetting();
  if (typeof setting.platform_fee_basis_points === "number") {
    const bps = Math.min(
      MAX_PLATFORM_FEE_BASIS_POINTS,
      Math.max(0, setting.platform_fee_basis_points),
    );
    return bps / 10000;
  }
  const value =
    typeof setting.platform_fee_percent === "number"
      ? setting.platform_fee_percent
      : DEFAULT_PLATFORM_FEE_PERCENT;
  const clamped = Math.min(
    MAX_PLATFORM_FEE_PERCENT,
    Math.max(MIN_PLATFORM_FEE_PERCENT, value),
  );
  return clamped / 100;
}

/**
 * Integer basis points (1 bp = 0.01%). Use: Math.round((grossCents * bps) / 10000).
 */
async function getPlatformFeeBasisPoints() {
  const setting = await getOrCreatePlatformSetting();
  if (typeof setting.platform_fee_basis_points === "number") {
    return Math.min(
      MAX_PLATFORM_FEE_BASIS_POINTS,
      Math.max(0, setting.platform_fee_basis_points),
    );
  }
  return percentToBasisPoints(setting.platform_fee_percent);
}

async function getPublicPlatformSettings() {
  const setting = await getOrCreatePlatformSetting();
  const percent =
    typeof setting.platform_fee_percent === "number"
      ? setting.platform_fee_percent
      : DEFAULT_PLATFORM_FEE_PERCENT;
  const basisPoints =
    typeof setting.platform_fee_basis_points === "number"
      ? setting.platform_fee_basis_points
      : percentToBasisPoints(percent);
  return {
    platformFeePercent: percent,
    platformFeeBasisPoints: basisPoints,
  };
}

async function getAdminStripeAccountId() {
  const setting = await getOrCreatePlatformSetting();
  if (!setting.admin_stripe_account_id) {
    return null;
  }

  if (!setting.admin_stripe_charges_enabled) {
    return null;
  }

  return setting.admin_stripe_account_id;
}

async function assertAdminUser(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }

  if (user.user_type !== "admin") {
    throw createHttpError(403, "Only admin users can manage platform settings.");
  }

  return user;
}

async function getAdminPlatformSettings({ clerkUserId }) {
  await assertAdminUser(clerkUserId);
  const setting = await getOrCreatePlatformSetting();
  return serializePlatformSetting(setting);
}

async function updateAdminPlatformFeePercent({ clerkUserId, platformFeePercent }) {
  await assertAdminUser(clerkUserId);

  const numericValue = Number(platformFeePercent);

  if (!Number.isFinite(numericValue)) {
    throw createHttpError(400, "Platform fee percent must be a number.");
  }

  if (numericValue < MIN_PLATFORM_FEE_PERCENT || numericValue > MAX_PLATFORM_FEE_PERCENT) {
    throw createHttpError(
      400,
      `Platform fee percent must be between ${MIN_PLATFORM_FEE_PERCENT} and ${MAX_PLATFORM_FEE_PERCENT}.`,
    );
  }

  const setting = await getOrCreatePlatformSetting();
  const roundedPercent = Math.round(numericValue * 100) / 100;
  setting.platform_fee_percent = roundedPercent;
  setting.platform_fee_basis_points = percentToBasisPoints(roundedPercent);
  setting.updated_at = new Date();
  await setting.save();

  return serializePlatformSetting(setting);
}

module.exports = {
  DEFAULT_PLATFORM_FEE_PERCENT,
  DEFAULT_PLATFORM_FEE_BASIS_POINTS,
  percentToBasisPoints,
  basisPointsToPercent,
  getOrCreatePlatformSetting,
  getPublicPlatformSettings,
  getPlatformFeeFraction,
  getPlatformFeeBasisPoints,
  getAdminStripeAccountId,
  getAdminPlatformSettings,
  updateAdminPlatformFeePercent,
  serializePlatformSetting,
};
