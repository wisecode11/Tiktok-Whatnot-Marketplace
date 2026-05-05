const {
  createPendingInventory,
  listPendingInventoryForSeller,
  syncPendingInventoryForSeller,
} = require("../services/pendingInventoryService");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };

  if (error.details) {
    payload.details = error.details;
  }

  return res.status(status).json(payload);
}

async function createPendingInventoryEntry(req, res) {
  try {
    const result = await createPendingInventory({
      clerkUserId: req.auth.userId,
      subcategoryId: req.body && req.body.subcategoryId,
      title: req.body && req.body.title,
      description: req.body && req.body.description,
      quantity: req.body && req.body.quantity,
      priceUsd: req.body && req.body.priceUsd,
      shippingProfileId: req.body && req.body.shippingProfileId,
      hazmatType: req.body && req.body.hazmatType,
      imageId: req.body && req.body.imageId,
      imagePayload: req.body && req.body.imagePayload,
    });

    return res.status(201).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  createPendingInventoryEntry,
  listPendingInventoryForSellerEntry,
  syncPendingInventoryForSellerEntry,
};

async function listPendingInventoryForSellerEntry(req, res) {
  try {
    const result = await listPendingInventoryForSeller({
      clerkUserId: req.auth.userId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function syncPendingInventoryForSellerEntry(req, res) {
  try {
    const result = await syncPendingInventoryForSeller({
      clerkUserId: req.auth.userId,
      pendingInventoryId: req.params.pendingInventoryId,
    });

    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}
