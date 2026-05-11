const PendingInventory = require("../models/PendingInventory");
const User = require("../models/Users");
const WhatnotProfileShipping = require("../models/WhatnotProfileShipping");
const WhatnotSubCategory = require("../models/WhatnotSubCategory");
const {
  createWhatnotListingFromPlatform,
  generateWhatnotMediaUploadUrlsFromPlatform,
  getWhatnotExtensionConnectionStatus,
} = require("./integrationService");

const AUTO_SYNC_INTERVAL_MS = Number(process.env.PENDING_INVENTORY_AUTO_SYNC_INTERVAL_MS || 15000);
const AUTO_SYNC_BATCH_SIZE = Number(process.env.PENDING_INVENTORY_AUTO_SYNC_BATCH_SIZE || 5);

let autoSyncWorkerTimer = null;
let autoSyncWorkerRunning = false;
const inFlightPendingSyncIds = new Set();

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  error.details = details;
  return error;
}

function normalizeString(value) {
  return typeof value === "string" ? value.trim() : "";
}

function isRetryableAutoSyncError(error) {
  const status = Number(error && error.status);
  if ([401, 403, 503, 504].includes(status)) {
    return true;
  }

  const message = normalizeString(error && error.message).toLowerCase();
  if (!message) {
    return false;
  }

  return [
    "extension",
    "offline",
    "reconnect",
    "relogin",
    "timed out",
    "timeout",
    "not connected",
    "disconnected",
  ].some((token) => message.includes(token));
}

function scheduleAutoSyncForPendingItem(pendingInventoryId) {
  const normalizedPendingInventoryId = normalizeString(pendingInventoryId);
  if (!normalizedPendingInventoryId) {
    return;
  }

  setTimeout(() => {
    void autoSyncPendingInventoryById({ pendingInventoryId: normalizedPendingInventoryId });
  }, 0);
}

async function findAuthenticatedUser(clerkUserId) {
  const normalizedClerkUserId = normalizeString(clerkUserId);
  if (!normalizedClerkUserId) {
    throw createHttpError(400, "Missing Clerk user id.");
  }

  const user = await User.findOne({ clerk_user_id: normalizedClerkUserId });
  if (!user) {
    throw createHttpError(404, "Authenticated user was not found.");
  }

  return user;
}

function resolveOwnerSellerUserId(user) {
  if (user.user_type === "seller") {
    return user._id;
  }
  if (user.user_type === "staff" && typeof user.parent_seller_user_id === "string" && user.parent_seller_user_id.trim()) {
    return user.parent_seller_user_id.trim();
  }
  throw createHttpError(403, "Only seller or staff users can create pending inventory.");
}

async function createPendingInventory({
  clerkUserId,
  subcategoryId,
  title,
  description,
  quantity,
  priceUsd,
  shippingProfileId,
  hazmatType,
  imageId,
  imagePayload,
}) {
  const user = await findAuthenticatedUser(clerkUserId);
  const ownerSellerUserId = resolveOwnerSellerUserId(user);
  const normalizedSubcategoryId = normalizeString(subcategoryId);
  const normalizedTitle = normalizeString(title);
  const normalizedDescription = normalizeString(description);
  const normalizedShippingProfileId = normalizeString(shippingProfileId);
  const normalizedHazmatType = normalizeString(hazmatType);
  const normalizedImageId = normalizeString(imageId);
  const normalizedQuantity = Number(quantity);
  const normalizedPriceUsd = Number(priceUsd);

  if (!normalizedSubcategoryId) {
    throw createHttpError(400, "subcategoryId is required.");
  }
  if (!normalizedTitle) {
    throw createHttpError(400, "title is required.");
  }
  if (!normalizedDescription) {
    throw createHttpError(400, "description is required.");
  }
  if (!Number.isFinite(normalizedQuantity) || normalizedQuantity <= 0 || !Number.isInteger(normalizedQuantity)) {
    throw createHttpError(400, "quantity must be a whole number greater than 0.");
  }
  if (!Number.isFinite(normalizedPriceUsd) || normalizedPriceUsd <= 0) {
    throw createHttpError(400, "priceUsd must be greater than 0.");
  }
  if (!normalizedShippingProfileId) {
    throw createHttpError(400, "shippingProfileId is required.");
  }
  if (!normalizedHazmatType) {
    throw createHttpError(400, "hazmatType is required.");
  }

  if (!imagePayload || typeof imagePayload !== "object" || Array.isArray(imagePayload)) {
    throw createHttpError(400, "imagePayload is required and must match GenerateMediaUploadUrls request shape.");
  }

  const mediaEntries = Array.isArray(imagePayload.media) ? imagePayload.media : [];
  const fileBase64 = normalizeString(imagePayload.fileBase64);
  if (!mediaEntries.length || !fileBase64) {
    throw createHttpError(400, "imagePayload must include media[] and fileBase64.");
  }

  const selectedSubcategory = await WhatnotSubCategory.findOne({
    platform: "whatnot",
    subcategory_id: normalizedSubcategoryId,
  }).sort({ updated_at: -1 });
  if (!selectedSubcategory) {
    throw createHttpError(400, "Selected subcategory was not found in Whatnot category cache.");
  }

  const selectedShippingProfile = await WhatnotProfileShipping.findOne({
    platform: "whatnot",
    WhatnotProfileShipping_id: normalizedShippingProfileId,
  }).sort({ updated_at: -1 });
  if (!selectedShippingProfile) {
    throw createHttpError(400, "Selected shipping profile was not found in Whatnot shipping profile cache.");
  }

  const now = new Date();
  const pendingInventory = new PendingInventory({
    owner_seller_user_id: ownerSellerUserId,
    created_by_user_id: user._id,
    created_by_clerk_user_id: user.clerk_user_id,
    subcategory_id: normalizedSubcategoryId,
    title: normalizedTitle,
    description: normalizedDescription,
    quantity: normalizedQuantity,
    price_usd: normalizedPriceUsd,
    shipping_profile_id: normalizedShippingProfileId,
    hazmat_type: normalizedHazmatType,
    image_id: normalizedImageId,
    image_payload: imagePayload,
    status: "PENDING",
    source: "staff-dashboard",
    created_at: now,
    updated_at: now,
  });

  await pendingInventory.save();
  scheduleAutoSyncForPendingItem(pendingInventory._id);

  return {
    item: {
      id: pendingInventory._id,
      ownerSellerUserId: pendingInventory.owner_seller_user_id,
      createdByUserId: pendingInventory.created_by_user_id,
      createdByClerkUserId: pendingInventory.created_by_clerk_user_id,
      subcategoryId: pendingInventory.subcategory_id,
      title: pendingInventory.title,
      description: pendingInventory.description,
      quantity: pendingInventory.quantity,
      priceUsd: pendingInventory.price_usd,
      shippingProfileId: pendingInventory.shipping_profile_id,
      hazmatType: pendingInventory.hazmat_type,
      imageId: pendingInventory.image_id || "",
      imagePayload: pendingInventory.image_payload,
      status: pendingInventory.status,
      source: pendingInventory.source,
      createdAt: pendingInventory.created_at,
      updatedAt: pendingInventory.updated_at,
    },
    message: "Pending inventory created successfully.",
  };
}

async function listPendingInventoryForSeller({ clerkUserId }) {
  const user = await findAuthenticatedUser(clerkUserId);
  if (user.user_type !== "seller") {
    throw createHttpError(403, "Only sellers can view pending inventory.");
  }

  const pendingItems = await PendingInventory.find({
    owner_seller_user_id: user._id,
    status: { $in: ["PENDING", "SYNCED", "FAILED"] },
  }).sort({ created_at: -1 });

  const createdByUserIds = pendingItems.map((item) => item.created_by_user_id).filter(Boolean);
  const createdByUsers = await User.find({ _id: { $in: createdByUserIds } });
  const createdByUserMap = new Map(createdByUsers.map((entry) => [entry._id, entry]));

  return {
    items: pendingItems.map((item) => {
      const createdByUser = createdByUserMap.get(item.created_by_user_id);
      const createdByName = createdByUser
        ? [createdByUser.first_name, createdByUser.last_name].filter(Boolean).join(" ").trim() || createdByUser.email
        : null;

      return {
        id: item._id,
        ownerSellerUserId: item.owner_seller_user_id,
        createdByUserId: item.created_by_user_id,
        createdByClerkUserId: item.created_by_clerk_user_id,
        createdByRole: createdByUser ? createdByUser.user_type : null,
        createdByName,
        createdByEmail: createdByUser ? createdByUser.email : null,
        subcategoryId: item.subcategory_id,
        title: item.title,
        description: item.description,
        quantity: item.quantity,
        priceUsd: item.price_usd,
        shippingProfileId: item.shipping_profile_id,
        hazmatType: item.hazmat_type,
        imageId: item.image_id || "",
        imagePayload: item.image_payload || {},
        status: item.status,
        syncedListingId: item.synced_listing_id,
        syncedListingUuid: item.synced_listing_uuid,
        syncedAt: item.synced_at,
        syncError: item.sync_error,
        source: item.source,
        createdAt: item.created_at,
        updatedAt: item.updated_at,
      };
    }).filter((item) => item.createdByRole === "staff"),
  };
}

function extractImageIdFromAddListingPhotoResponse(payload) {
  if (!payload || typeof payload !== "object") {
    return "";
  }
  const value =
    payload &&
    payload.data &&
    payload.data.addListingPhoto &&
    payload.data.addListingPhoto.image &&
    typeof payload.data.addListingPhoto.image.id === "string"
      ? payload.data.addListingPhoto.image.id.trim()
      : "";
  return value;
}

async function syncPendingInventoryItem({ pendingItem, markFailedOnError = true }) {
  const imagePayload = pendingItem.image_payload && typeof pendingItem.image_payload === "object"
    ? pendingItem.image_payload
    : null;

  const mediaEntries = imagePayload && Array.isArray(imagePayload.media) ? imagePayload.media : [];
  const fileBase64 = normalizeString(imagePayload && imagePayload.fileBase64);
  const fileContentType = normalizeString(imagePayload && imagePayload.fileContentType);

  const preferredListingPhotoLabel =
    mediaEntries[0] && typeof mediaEntries[0].id === "string"
      ? normalizeString(mediaEntries[0].id)
      : "";

  if (!mediaEntries.length || !fileBase64) {
    throw createHttpError(
      400,
      "Pending inventory image payload is invalid for GenerateMediaUploadUrls (need media[] and fileBase64 from staff create).",
    );
  }

  const uploadResponse = await generateWhatnotMediaUploadUrlsFromPlatform({
    media: mediaEntries,
    fileBase64,
    fileContentType,
    ...(preferredListingPhotoLabel ? { preferredAddListingPhotoLabel: preferredListingPhotoLabel } : {}),
  });

  const imageIdFromPhoto = extractImageIdFromAddListingPhotoResponse(uploadResponse);
  if (!imageIdFromPhoto) {
    throw createHttpError(502, "Failed to resolve image id from AddListingPhoto response.", uploadResponse);
  }

  pendingItem.image_id = imageIdFromPhoto;

  try {
    const listingResponse = await createWhatnotListingFromPlatform({
      title: pendingItem.title,
      description: pendingItem.description,
      quantity: pendingItem.quantity,
      priceUsd: pendingItem.price_usd,
      subcategoryId: pendingItem.subcategory_id,
      shippingProfileId: pendingItem.shipping_profile_id,
      hazmatType: pendingItem.hazmat_type,
      imageId: imageIdFromPhoto,
    });

    const listingNode =
      listingResponse &&
      listingResponse.data &&
      listingResponse.data.createListing &&
      listingResponse.data.createListing.listingNode
        ? listingResponse.data.createListing.listingNode
        : null;

    pendingItem.status = "SYNCED";
    pendingItem.synced_listing_id = listingNode && listingNode.id ? String(listingNode.id) : null;
    pendingItem.synced_listing_uuid = listingNode && listingNode.uuid ? String(listingNode.uuid) : null;
    pendingItem.synced_at = new Date();
    pendingItem.sync_error = null;
    pendingItem.sync_response = listingResponse;
    pendingItem.updated_at = new Date();
    await pendingItem.save();

    return {
      item: {
        id: pendingItem._id,
        status: pendingItem.status,
        imageId: pendingItem.image_id || "",
        syncedListingId: pendingItem.synced_listing_id,
        syncedListingUuid: pendingItem.synced_listing_uuid,
        syncedAt: pendingItem.synced_at,
        syncError: pendingItem.sync_error,
      },
      message: "Pending inventory synced successfully.",
    };
  } catch (error) {
    const shouldRetryInBackground = !markFailedOnError && isRetryableAutoSyncError(error);

    if (!shouldRetryInBackground) {
      pendingItem.status = "FAILED";
    }

    pendingItem.sync_error = error && error.message ? String(error.message) : "Sync failed.";
    pendingItem.updated_at = new Date();
    await pendingItem.save();

    if (shouldRetryInBackground) {
      return {
        item: {
          id: pendingItem._id,
          status: pendingItem.status,
          imageId: pendingItem.image_id || "",
          syncedListingId: pendingItem.synced_listing_id,
          syncedListingUuid: pendingItem.synced_listing_uuid,
          syncedAt: pendingItem.synced_at,
          syncError: pendingItem.sync_error,
        },
        message: "Pending inventory kept in queue. Auto-sync will retry when extension is connected.",
      };
    }

    throw error;
  }
}

async function autoSyncPendingInventoryById({ pendingInventoryId }) {
  const normalizedPendingId = normalizeString(pendingInventoryId);
  if (!normalizedPendingId || inFlightPendingSyncIds.has(normalizedPendingId)) {
    return;
  }

  inFlightPendingSyncIds.add(normalizedPendingId);
  try {
    const pendingItem = await PendingInventory.findOne({ _id: normalizedPendingId });
    if (!pendingItem || pendingItem.status !== "PENDING") {
      return;
    }

    const ownerSeller = await User.findOne({ _id: pendingItem.owner_seller_user_id });
    const ownerSellerClerkUserId = normalizeString(ownerSeller && ownerSeller.clerk_user_id);
    if (!ownerSellerClerkUserId) {
      return;
    }

    const extensionStatus = await getWhatnotExtensionConnectionStatus({
      clerkUserId: ownerSellerClerkUserId,
    });

    if (!extensionStatus || !extensionStatus.connected) {
      return;
    }

    await syncPendingInventoryItem({ pendingItem, markFailedOnError: false });
  } catch (_error) {
    // Keep worker resilient; item-level status handling is done in syncPendingInventoryItem.
  } finally {
    inFlightPendingSyncIds.delete(normalizedPendingId);
  }
}

async function processPendingInventoryAutoSyncQueue() {
  if (autoSyncWorkerRunning) {
    return;
  }

  autoSyncWorkerRunning = true;
  try {
    const pendingItems = await PendingInventory.find({
      status: "PENDING",
      source: "staff-dashboard",
    })
      .sort({ created_at: 1 })
      .limit(Math.max(1, AUTO_SYNC_BATCH_SIZE));

    for (const item of pendingItems) {
      // eslint-disable-next-line no-await-in-loop
      await autoSyncPendingInventoryById({ pendingInventoryId: item._id });
    }
  } finally {
    autoSyncWorkerRunning = false;
  }
}

function startPendingInventoryAutoSyncWorker() {
  if (autoSyncWorkerTimer) {
    return;
  }

  autoSyncWorkerTimer = setInterval(() => {
    void processPendingInventoryAutoSyncQueue();
  }, Math.max(5000, AUTO_SYNC_INTERVAL_MS));

  if (typeof autoSyncWorkerTimer.unref === "function") {
    autoSyncWorkerTimer.unref();
  }

  void processPendingInventoryAutoSyncQueue();
}

async function syncPendingInventoryForSeller({ clerkUserId, pendingInventoryId }) {
  const user = await findAuthenticatedUser(clerkUserId);
  if (user.user_type !== "seller") {
    throw createHttpError(403, "Only sellers can sync pending inventory.");
  }

  const normalizedPendingId = normalizeString(pendingInventoryId);
  if (!normalizedPendingId) {
    throw createHttpError(400, "pendingInventoryId is required.");
  }

  const pendingItem = await PendingInventory.findOne({
    _id: normalizedPendingId,
    owner_seller_user_id: user._id,
  });
  if (!pendingItem) {
    throw createHttpError(404, "Pending inventory item not found.");
  }

  return syncPendingInventoryItem({ pendingItem, markFailedOnError: true });
}

module.exports = {
  createPendingInventory,
  listPendingInventoryForSeller,
  startPendingInventoryAutoSyncWorker,
  syncPendingInventoryForSeller,
};
