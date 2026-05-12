/**
 * Mock for TikTok Partner `GET /product/202309/products/{product_id}`.
 * Uses a production-shaped envelope; per-id tweaks match the global search mock list.
 */

const fs = require("fs");
const path = require("path");

const ENVELOPE_PATH = path.join(__dirname, "tiktokGlobalProductDetailEnvelope.json");

const META_BY_ID = {
  "1729592969712207008": {
    title: "Short Boat Invisible Socks",
    status: "SELLER_DEACTIVATED",
    product_status: "SELLER_DEACTIVATED",
    skuSellerSku: "Color-Red-XM01",
    skuId: "1729592969712207012",
    inventoryQty: 999,
  },
  "1729592969712207009": {
    title: "Athletic Cushion Crew Socks",
    status: "ACTIVATE",
    product_status: "ACTIVATE",
    skuSellerSku: "Color-Blue-LG02",
    skuId: "1729592969712207013",
    inventoryQty: 120,
  },
  "1729592969712207010": {
    title: "Merino Wool Hiking Socks",
    status: "SELLER_DEACTIVATED",
    product_status: "SELLER_DEACTIVATED",
    skuSellerSku: "Wool-Grey-MD01",
    skuId: "1729592969712207014",
    inventoryQty: 45,
  },
};

function deepClone(value) {
  return JSON.parse(JSON.stringify(value));
}

/**
 * @param {string} productId
 */
function buildMockGlobalProductGetResponse(productId) {
  const id = typeof productId === "string" ? productId.trim() : String(productId ?? "").trim();
  if (!id) {
    return { code: 36009001, message: "product_id is required.", request_id: "MOCK_BAD_REQUEST", data: null };
  }

  const meta = META_BY_ID[id];
  if (!meta) {
    return {
      code: 36009003,
      message: `Mock catalog: no detail for product_id ${id}. Use an id from the TikTok inventory table.`,
      request_id: "MOCK_NOT_FOUND",
      data: null,
    };
  }

  const raw = fs.readFileSync(ENVELOPE_PATH, "utf8");
  const envelope = JSON.parse(raw);
  const out = deepClone(envelope);
  const data = out.data;
  data.id = id;
  data.title = meta.title;
  data.status = meta.status;
  data.product_status = meta.product_status;
  if (Array.isArray(data.product_families) && data.product_families[0]) {
    data.product_families[0].products = [{ id }];
  }
  data.primary_combined_product_id = id;
  if (Array.isArray(data.skus) && data.skus[0]) {
    data.skus[0].id = meta.skuId;
    data.skus[0].seller_sku = meta.skuSellerSku;
    if (Array.isArray(data.skus[0].inventory) && data.skus[0].inventory[0]) {
      data.skus[0].inventory[0].quantity = meta.inventoryQty;
    }
  }
  return out;
}

module.exports = { buildMockGlobalProductGetResponse };
