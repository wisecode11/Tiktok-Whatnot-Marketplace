/**
 * TikTok Shop Partner API — mock payloads for development and when no seller shop credentials are wired.
 * Shapes mirror `POST /order/202309/orders/search` `data.orders[]` entries from official docs/samples.
 */

const MOCK_NEXT_PAGE_TOKEN =
  "6AsPQsUMvH3RkchNUPPh22NROHkE0D8pmq/N5M1kHYcZmtRyv9aVrNv65W7Q6tFA+7D1ud64MPNz5OaT";

const SAMPLE_LINE_ITEM = {
  id: "577086512123755123",
  sku_id: "2729382476852921560",
  combined_listing_skus: [
    {
      sku_id: "2729382476852921123",
      sku_count: 1,
      product_id: "1729582718312380456",
      seller_sku: "yellow-24-XL ",
    },
  ],
  display_status: "UNPAID",
  product_name: "Women's Winter Crochet Clothes",
  seller_sku: "red_iphone_256",
  sku_image: "https://p16-oec-va.itexeitg.com/tos-maliva-d-o5syd03w52-us/46123e87d14f40b69b839",
  sku_name: "Iphone",
  product_id: "1729582718312380123",
  sale_price: "0.01",
  pfand_fee: "1.50",
  platform_discount: "0",
  seller_discount: "0",
  sku_type: "PRE_ORDER",
  cancel_reason: "Discount not as expected",
  original_price: "0.01",
  rts_time: 1678389618,
  package_status: "TO_FULFILL",
  currency: "IDR",
  shipping_provider_name: "TT Virtual express",
  cancel_user: "BUYER",
  shipping_provider_id: "6617675021119438849",
  is_gift: false,
  item_tax: [
    {
      tax_type: "SALES_TAX",
      tax_amount: "21.2",
      tax_rate: "0.35",
    },
  ],
  tracking_number: "JX12345",
  package_id: "1153132168123859123",
  retail_delivery_fee: "1.28",
  buyer_service_fee: "1000",
  small_order_fee: "5000",
  handling_duration_days: "7",
  is_dangerous_good: false,
  needs_prescription: false,
  gift_retail_price: "20",
  is_unboxing_item: false,
  unboxing_sku_code: "14531134",
  sub_item_info: [
    {
      id: "577086512123755123",
      sku_id: "2729382476852921560",
      display_status: "UNPAID",
      product_name: "Women's Winter Crochet Clothes",
      seller_sku: "red_iphone_256",
      sku_image: "https://p16-oec-va.itexeitg.com/tos-maliva-d-o5syd03w52-us/46123e87d14f40b69b839",
      sku_name: "Iphone",
      product_id: "1729582718312380123",
      sale_price: "0.01",
      platform_discount: "0",
      seller_discount: "0",
      cancel_reason: "Discount not as expected",
      original_price: "0.01",
      rts_time: 1678389618,
      package_status: "TO_FULFILL",
      currency: "USD",
      shipping_provider_name: "TT Virtual express",
      cancel_user: "BUYER",
      shipping_provider_id: "6617675021119438849",
      item_tax: [
        {
          tax_type: "SALES_TAX",
          tax_amount: "21.2",
          tax_rate: "0.35",
        },
      ],
      tracking_number: "JX12345",
      package_id: "1153132168123859123",
      retail_delivery_fee: "1.28",
      is_dangerous_good: false,
      warehouse_id: "6955005333819123123",
    },
  ],
  distance_shipping_fee: "1000",
  distance_fee: "2000",
};

const MOCK_PRIMARY_ORDER = {
  id: "576461413038785752",
  buyer_message: "Please ship asap!",
  cancellation_initiator: "SELLER",
  shipping_provider_id: "6617675021119438849",
  create_time: 1619611561,
  shipping_provider: "TT Virtual express",
  packages: [{ id: "1152321127278713123" }],
  payment: {
    currency: "IDR",
    sub_total: "5000",
    shipping_fee: "5000",
    seller_discount: "5000",
    platform_discount: "5000",
    payment_platform_discount: "10",
    payment_discount_service_fee: "10",
    total_amount: "5000",
    original_total_product_price: "5000",
    original_shipping_fee: "5000",
    shipping_fee_seller_discount: "5000",
    shipping_fee_platform_discount: "5000",
    shipping_fee_cofunded_discount: "5000",
    tax: "5000",
    small_order_fee: "3000",
    shipping_fee_tax: "11",
    product_tax: "21.3",
    retail_delivery_fee: "1.28",
    buyer_service_fee: "1000",
    handling_fee: "1000",
    shipping_insurance_fee: "1000",
    item_insurance_fee: "1000",
    item_insurance_tax: "10",
    distance_shipping_fee: "1000",
    distance_fee: "2000",
  },
  recipient_address: {
    full_address: "1199 Coleman Ave San Jose, CA 95110",
    phone_number: "(+1)213-***-1234",
    name: "David Kong",
    first_name: "David",
    last_name: "Kong",
    first_name_local_script: "ジョン",
    last_name_local_script: "ドゥ",
    address_detail: "Unit one building 8",
    address_line1: "TikTok 5800 bristol Pkwy",
    address_line2: "Suite 100",
    address_line3: " ",
    address_line4: " ",
    district_info: [
      {
        address_level_name: "Country",
        address_name: "United Kingdom",
        address_level: "L0",
        iso_code: "VAN",
      },
    ],
    delivery_preferences: {
      drop_off_location: "Front Door",
    },
    postal_code: "95110",
    region_code: "US",
    post_town: "Ribbleton",
  },
  status: "UNPAID",
  fulfillment_type: "FULFILLMENT_BY_SELLER",
  delivery_type: "HOME_DELIVERY",
  paid_time: 1619611563,
  rts_sla_time: 1619611688,
  tts_sla_time: 1619611761,
  cancel_reason: "Pricing error",
  update_time: 1619621355,
  payment_method_name: "CCDC",
  rts_time: 1619611563,
  tracking_number: "JX12345",
  split_or_combine_tag: "COMBINED",
  has_updated_recipient_address: false,
  cancel_order_sla_time: 1619621355,
  warehouse_id: "6955005333819123123",
  request_cancel_time: 1678389618,
  shipping_type: "TIKTOK",
  user_id: "7021436810468230477",
  seller_note: "seller note",
  delivery_sla_time: 1678389618,
  is_cod: false,
  delivery_option_id: "7091146663229654785",
  cancel_time: 1678389618,
  need_upload_invoice: "NEED_INVOICE",
  delivery_option_name: "Standard Shipping",
  cpf: "3213-31231412",
  line_items: [SAMPLE_LINE_ITEM],
  buyer_email: "v2b2V5@chat.seller.tiktok.com",
  delivery_due_time: 1678389618,
  is_sample_order: false,
  shipping_due_time: 1678389618,
  collection_due_time: 1678389618,
  delivery_option_required_delivery_time: 1678389618,
  is_on_hold_order: false,
  delivery_time: 1678389618,
  is_replacement_order: false,
  is_subscription_order: true,
  collection_time: 1678389618,
  replaced_order_id: "576461416728782174",
  is_buyer_request_cancel: false,
  pick_up_cut_off_time: 1678389618,
  fast_dispatch_sla_time: 1678389618,
  commerce_platform: "TIKTOK_SHOP",
  order_type: "ZERO_LOTTERY",
  release_date: 1619611762,
  handling_duration: {
    days: "7",
    type: "BUSINESS_DAY",
  },
  auto_combine_group_id: "12345677",
  cpf_name: "John Smith",
  is_exchange_order: false,
  exchange_source_order_id: "576461413038785752",
  consultation_id: "123456",
  fast_delivery_program: "3_DAY_DELIVERY",
  fulfillment_priority_level: 100,
  recommended_shipping_time: 1619611561,
  buyer_nickname: "user213123",
  buyer_avatar:
    "https://p16-oec-va.itexeitg.com/tos-maliva-d-o5syd03w52-us/46123e87d14f40b69b839",
  order_rights: [1],
};

/** Second demo row — different identifiers and fulfillment state (still illustrative). */
const MOCK_SECOND_ORDER = {
  id: "576461413038785755",
  create_time: 1619710000,
  update_time: 1619720000,
  status: "AWAITING_SHIPMENT",
  buyer_nickname: "demo_buyer_az",
  user_id: "7021436810468230499",
  fulfillment_type: "FULFILLMENT_BY_SELLER",
  shipping_type: "SELLER",
  warehouse_id: "6955005333819123999",
  payment: {
    currency: "USD",
    total_amount: "129.99",
    sub_total: "120.00",
    shipping_fee: "9.99",
    seller_discount: "0",
    platform_discount: "0",
    tax: "5.40",
    small_order_fee: "0",
  },
  recipient_address: {
    full_address: "100 Market Street, Austin, TX 78701",
    phone_number: "(+1)512-***-9000",
    name: "Alex Rivera",
    postal_code: "78701",
    region_code: "US",
    district_info: [],
  },
  line_items: [
    {
      id: "577086512123755200",
      product_id: "1729582718312380999",
      sku_id: "2729382476852921999",
      product_name: "Demo enamel pin set",
      sku_name: "Pack of 6",
      sale_price: "120.00",
      original_price: "129.99",
      currency: "USD",
      package_status: "TO_FULFILL",
      display_status: "AWAITING_SHIPMENT",
    },
  ],
  packages: [{ id: "1152321127278713200" }],
  commerce_platform: "TIKTOK_SHOP",
  delivery_type: "HOME_DELIVERY",
};

function pickMockOrders(filters) {
  const bodyFilters = filters && typeof filters === "object" ? filters : {};
  let list = [MOCK_PRIMARY_ORDER, MOCK_SECOND_ORDER];
  if (typeof bodyFilters.order_status === "string" && bodyFilters.order_status.trim()) {
    const want = bodyFilters.order_status.trim();
    list = list.filter((o) => o.status === want);
  }
  return list;
}

/**
 * Simulated search response (`data` object shape). Pagination is mocked over the small static list only;
 * `total_count` mimics Partner sample totals while `orders.length` stays small for readability.
 */
function buildMockOrdersSearch(filters, pageSize, pageToken) {
  const allMatching = pickMockOrders(filters);
  const sizeNum = Number(pageSize);
  const safeSize = Number.isFinite(sizeNum)
    ? Math.min(Math.max(sizeNum, 1), 100)
    : 20;

  const tokenRaw = typeof pageToken === "string" ? pageToken.trim() : "";
  let offset = 0;

  const mo = /^__marketplace_mock_offset_(\d+)__$/.exec(tokenRaw);
  if (mo) {
    offset = Number.parseInt(mo[1], 10);
    if (!Number.isFinite(offset) || offset < 0) {
      offset = 0;
    }
  }

  const sliced = allMatching.slice(offset, offset + safeSize);
  const nextOffset = offset + sliced.length;
  const hasMoreRowsInDemoList = nextOffset < allMatching.length;

  return {
    total_count: 22113,
    next_page_token: hasMoreRowsInDemoList ? `__marketplace_mock_offset_${nextOffset}__` : null,
    orders: sliced,
    request_id: "202203070749000101890810281E8C70B7",
  };
}

function findMockOrderById(orderId) {
  const id = typeof orderId === "string" ? orderId.trim() : "";
  if (!id) {
    return null;
  }
  return MOCK_PRIMARY_ORDER.id === id
    ? MOCK_PRIMARY_ORDER
    : MOCK_SECOND_ORDER.id === id
      ? MOCK_SECOND_ORDER
      : null;
}

module.exports = {
  MOCK_PRIMARY_ORDER,
  MOCK_SECOND_ORDER,
  MOCK_TOTAL_COUNT_DEMO: 22113,
  MOCK_NEXT_PAGE_TOKEN,
  MOCK_ORDERS: [MOCK_PRIMARY_ORDER, MOCK_SECOND_ORDER],
  buildMockOrdersSearch,
  findMockOrderById,
};
