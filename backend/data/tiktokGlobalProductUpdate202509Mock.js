/**
 * Mock envelope for TikTok Partner `PUT /product/202509/products/{product_id}`.
 */

function buildMockGlobalProductUpdate202509Response(productId, body = {}) {
  const id = typeof productId === "string" ? productId.trim() : String(productId ?? "").trim();
  const skusIn = Array.isArray(body.skus) ? body.skus : [];
  const first = skusIn[0] && typeof skusIn[0] === "object" ? skusIn[0] : {};

  return {
    code: 0,
    message: "Success",
    request_id: "202203070749000101890810281E8C70B7",
    data: {
      product_id: id || "1729592969712207008",
      skus: [
        {
          id: first.id != null ? String(first.id) : "1729592969712207012",
          seller_sku: String(first.seller_sku || "Color-Red-XM001"),
          sales_attributes: Array.isArray(first.sales_attributes)
            ? first.sales_attributes
            : [
                {
                  id: "100000",
                  value_id: "1729592969712207123",
                },
              ],
          external_sku_id: first.external_sku_id != null ? String(first.external_sku_id) : "1729592969712207234",
          fees: Array.isArray(first.fees)
            ? first.fees
            : [
                {
                  type: "PFAND",
                  amount: "1.01",
                  additional_attribute: "SINGLE_USE",
                },
              ],
        },
      ],
      warnings: [
        {
          message:
            "The [brand_id]:123 field is incorrect and has been automatically cleared by the system. Reason: [Brand does not exist]. You can edit it later.",
        },
      ],
      audit: {
        status: "AUDITING",
      },
    },
  };
}

module.exports = { buildMockGlobalProductUpdate202509Response };
