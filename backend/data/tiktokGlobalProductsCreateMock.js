/**
 * TikTok Shop Partner API — mock response for `POST /product/202309/products`.
 *
 * NOTE: This mock intentionally returns a production-like envelope so the UI
 * can treat it like a real create flow while approval is pending.
 */

function buildMockGlobalProductsCreateResponse(body = {}) {
  const firstSku = Array.isArray(body.skus) && body.skus.length ? body.skus[0] : {}

  const sellerSku = String(firstSku.seller_sku || "Color-Red-XM001")
  const externalSkuId =
    firstSku.external_sku_id != null
      ? String(firstSku.external_sku_id)
      : "1729592969712207234"

  return {
    code: 0,
    message: "Success",
    request_id: "202203070749000101890810281E8C70B7",
    data: {
      product_id: "1729592969712207008",
      skus: [
        {
          id: "1729592969712207012",
          seller_sku: sellerSku,
          sales_attributes: Array.isArray(firstSku.sales_attributes) ? firstSku.sales_attributes : [
            {
              id: "100089",
              value_id: "1729592969712207000",
              value_name: "Red",
            },
          ],
          external_sku_id: externalSkuId,
          fees: Array.isArray(firstSku.fees)
            ? firstSku.fees
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
    },
  }
}

module.exports = { buildMockGlobalProductsCreateResponse }

