/**
 * TikTok Shop Partner API — mock envelope for `POST /product/202309/global_products/search`.
 * Shape matches the live Partner API response so the UI can switch to real calls later.
 */

const MOCK_NEXT_PAGE_TOKEN = "b2Zmc2V0PTAK";

function sampleProduct(overrides = {}) {
  const base = {
    id: "1729592969712207008",
    title: "Short Boat Invisible Socks",
    status: "ACTIVATE",
    skus: [
      {
        id: "1729592969712207012",
        seller_sku: "Color-Red-XM01",
        price: {
          currency: "USD",
          tax_exclusive_price: "111.01",
          sale_price: "121.11",
        },
        inventory: [
          {
            warehouse_id: "7068517275539719942",
            quantity: 999,
            backorder_quantity: 888,
            handling_time: 5,
          },
        ],
        list_price: {
          amount: "1",
          currency: "USD",
        },
        external_list_prices: [
          {
            source: "SHOPIFY_COMPARE_AT_PRICE",
            amount: "1",
            currency: "USD",
          },
        ],
        pre_sale: {
          type: "PRE_ORDER",
          fulfillment_type: {
            handling_duration_days: 7,
            release_date: 1619611761,
          },
        },
        status_info: {
          status: "DEACTIVATED",
          deactivation_source: "PLATFORM",
        },
        fees: [
          {
            type: "PFAND",
            amount: "1.01",
            additional_attribute: "SINGLE_USE",
          },
        ],
      },
    ],
    sales_regions: ["US"],
    create_time: 1234567890,
    update_time: 1234567800,
    product_sync_fail_reasons: ["The required qualification is missed."],
    is_not_for_sale: true,
    recommended_categories: [
      {
        id: "853000",
        local_name: "Botol & Stoples Penyimpanan",
      },
    ],
    listing_quality_tier: "POOR",
    integrated_platform_statuses: [
      {
        platform: "TOKOPEDIA",
        status: "PLATFORM_DEACTIVATED",
      },
    ],
    audit: {
      status: "AUDITING",
      pre_approved_reasons: ["KYC_PENDING"],
    },
    product_families: [
      {
        id: "1000592969712207000",
        products: [{ id: "1729592969712207008" }],
      },
    ],
    has_draft: true,
    scheduled_sale: {
      is_enabled_scheduled_sale: false,
      schedule_sale_time: 1768899145000,
    },
  };
  return { ...base, ...overrides };
}

/**
 * @param {{ pageSize?: number; pageToken?: string; filters?: Record<string, unknown> }} opts
 */
function buildMockGlobalProductsSearch(opts = {}) {
  const pageSize = Math.min(Math.max(Number(opts.pageSize) || 100, 1), 100);
  const pageToken = typeof opts.pageToken === "string" ? opts.pageToken.trim() : "";

  if (pageToken === MOCK_NEXT_PAGE_TOKEN) {
    return {
      code: 0,
      message: "Success",
      request_id: "202203070749000101890810281E8C70B7",
      data: {
        total_count: 200,
        products: [],
        next_page_token: null,
      },
    };
  }

  const products = [
    sampleProduct(),
    sampleProduct({
      id: "1729592969712207009",
      title: "Athletic Cushion Crew Socks",
      listing_quality_tier: "FAIR",
      has_draft: false,
      skus: [
        {
          ...sampleProduct().skus[0],
          id: "1729592969712207013",
          seller_sku: "Color-Blue-LG02",
          price: {
            currency: "USD",
            tax_exclusive_price: "24.50",
            sale_price: "29.99",
          },
          inventory: [
            {
              warehouse_id: "7068517275539719943",
              quantity: 120,
              backorder_quantity: 0,
              handling_time: 2,
            },
          ],
        },
      ],
      product_families: [
        {
          id: "1000592969712207001",
          products: [{ id: "1729592969712207009" }],
        },
      ],
    }),
    sampleProduct({
      id: "1729592969712207010",
      title: "Merino Wool Hiking Socks",
      status: "SELLER_DEACTIVATED",
      listing_quality_tier: "GOOD",
      is_not_for_sale: false,
      skus: [
        {
          ...sampleProduct().skus[0],
          id: "1729592969712207014",
          seller_sku: "Wool-Grey-MD01",
          price: {
            currency: "USD",
            tax_exclusive_price: "45.00",
            sale_price: "52.00",
          },
          inventory: [
            {
              warehouse_id: "7068517275539719942",
              quantity: 45,
              backorder_quantity: 10,
              handling_time: 3,
            },
          ],
        },
      ],
      product_families: [
        {
          id: "1000592969712207002",
          products: [{ id: "1729592969712207010" }],
        },
      ],
    }),
  ].slice(0, pageSize);

  return {
    code: 0,
    message: "Success",
    request_id: "202203070749000101890810281E8C70B7",
    data: {
      total_count: 200,
      products,
      next_page_token: MOCK_NEXT_PAGE_TOKEN,
    },
  };
}

module.exports = {
  buildMockGlobalProductsSearch,
  MOCK_NEXT_PAGE_TOKEN,
};
