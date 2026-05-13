/**
 * Mock TikTok Shop API orders response
 * Matches the actual TikTok Shop Partner API response structure
 * Reference: https://partner.tiktokshop.com/docv2/page/order-search
 */

export interface MockTikTokOrder {
  id: string
  status: string
  create_time: number
  update_time: number
  buyer_nickname: string
  buyer_email?: string
  buyer_avatar?: string
  user_id?: string
  payment: {
    total_amount: string
    currency: string
    sub_total?: string
    tax?: string
    shipping_fee?: string
    original_total_product_price?: string
  }
  line_items: Array<{
    id: string
    product_id: string
    product_name: string
    sku_id: string
    seller_sku: string
    quantity: number
    sale_price: string
    currency: string
    display_status?: string
    package_status?: string
    sku_name?: string
  }>
  recipient_address?: {
    name: string
    phone_number?: string
    full_address?: string
    address_line1?: string
    address_line2?: string
    postal_code?: string
    region_code?: string
    first_name?: string
    last_name?: string
  }
  packages?: Array<{ id: string }>
  fulfillment_type?: string
  delivery_type?: string
  shipping_provider?: string
  tracking_number?: string
}

export interface MockTikTokOrdersSearchResponse {
  code: number
  message: string
  request_id: string
  data: {
    orders: MockTikTokOrder[]
    total_count: number
    next_page_token: string | null
  }
}

export const mockTikTokOrdersResponse: MockTikTokOrdersSearchResponse = {
  code: 0,
  message: "Success",
  request_id: "2026051212345678901",
  data: {
    total_count: 5,
    next_page_token: null,
    orders: [
      {
        id: "576461413038785001",
        status: "UNPAID",
        create_time: Math.floor(Date.now() / 1000) - 86400,
        update_time: Math.floor(Date.now() / 1000) - 80000,
        buyer_nickname: "user_sarahk",
        buyer_email: "v2b2V5@chat.seller.tiktok.com",
        payment: {
          total_amount: "49.99",
          currency: "USD",
          sub_total: "49.99",
          tax: "0",
          shipping_fee: "0",
        },
        line_items: [
          {
            id: "li_577086512001",
            product_id: "prod_wearables_001",
            product_name: "Wireless Earbuds",
            sku_id: "sku_wearables_001",
            seller_sku: "WB-SKU-001",
            quantity: 1,
            sale_price: "49.99",
            currency: "USD",
            display_status: "UNPAID",
            package_status: "TO_FULFILL",
          },
        ],
        fulfillment_type: "FULFILLMENT_BY_SELLER",
        recipient_address: {
          name: "Sarah Khan",
          phone_number: "(+1)555-***-0101",
          full_address: "123 Main St, New York, NY 10001",
          address_line1: "123 Main St",
          postal_code: "10001",
          region_code: "US",
        },
      },
      {
        id: "576461413038785002",
        status: "AWAITING_SHIPMENT",
        create_time: Math.floor(Date.now() / 1000) - 43200,
        update_time: Math.floor(Date.now() / 1000) - 40000,
        buyer_nickname: "amirbuyer99",
        buyer_email: "v2b2V6@chat.seller.tiktok.com",
        payment: {
          total_amount: "89.50",
          currency: "USD",
          sub_total: "85.00",
          tax: "4.50",
          shipping_fee: "0",
        },
        line_items: [
          {
            id: "li_577086512002",
            product_id: "prod_lighting_001",
            product_name: "Desk Lamp",
            sku_id: "sku_lighting_001",
            seller_sku: "DL-SKU-001",
            quantity: 1,
            sale_price: "49.99",
            currency: "USD",
            display_status: "AWAITING_SHIPMENT",
            package_status: "TO_FULFILL",
          },
          {
            id: "li_577086512003",
            product_id: "prod_cables_001",
            product_name: "USB-C Cable Set",
            sku_id: "sku_cables_001",
            seller_sku: "CC-SKU-001",
            quantity: 2,
            sale_price: "17.50",
            currency: "USD",
            display_status: "AWAITING_SHIPMENT",
            package_status: "TO_FULFILL",
          },
        ],
        fulfillment_type: "FULFILLMENT_BY_SELLER",
        recipient_address: {
          name: "Amir Raza",
          phone_number: "(+1)555-***-0102",
          full_address: "456 Oak Ave, Los Angeles, CA 90001",
          address_line1: "456 Oak Ave",
          postal_code: "90001",
          region_code: "US",
        },
      },
      {
        id: "576461413038785003",
        status: "ON_HOLD",
        create_time: Math.floor(Date.now() / 1000) - 43200,
        update_time: Math.floor(Date.now() / 1000) - 30000,
        buyer_nickname: "hinaali_shop",
        buyer_email: "v2b2V7@chat.seller.tiktok.com",
        payment: {
          total_amount: "129.00",
          currency: "USD",
          sub_total: "119.99",
          tax: "9.01",
          shipping_fee: "0",
        },
        line_items: [
          {
            id: "li_577086512004",
            product_id: "prod_wearables_002",
            product_name: "Smart Watch Pro",
            sku_id: "sku_wearables_002",
            seller_sku: "SW-SKU-001",
            quantity: 1,
            sale_price: "129.00",
            currency: "USD",
            display_status: "ON_HOLD",
            package_status: "TO_FULFILL",
          },
        ],
        fulfillment_type: "FULFILLMENT_BY_SELLER",
        recipient_address: {
          name: "Hina Ali",
          phone_number: "(+1)555-***-0103",
          full_address: "789 Pine Rd, Chicago, IL 60601",
          address_line1: "789 Pine Rd",
          postal_code: "60601",
          region_code: "US",
        },
      },
      {
        id: "576461413038785004",
        status: "UNPAID",
        create_time: Math.floor(Date.now() / 1000) - 172800,
        update_time: Math.floor(Date.now() / 1000) - 170000,
        buyer_nickname: "bilal_gamer",
        buyer_email: "v2b2V8@chat.seller.tiktok.com",
        payment: {
          total_amount: "39.00",
          currency: "USD",
          sub_total: "39.00",
          tax: "0",
          shipping_fee: "0",
        },
        line_items: [
          {
            id: "li_577086512005",
            product_id: "prod_peripherals_001",
            product_name: "Gaming Mouse",
            sku_id: "sku_peripherals_001",
            seller_sku: "GM-SKU-001",
            quantity: 1,
            sale_price: "39.00",
            currency: "USD",
            display_status: "UNPAID",
            package_status: "TO_FULFILL",
          },
        ],
        fulfillment_type: "FULFILLMENT_BY_SELLER",
        recipient_address: {
          name: "Bilal Ahmed",
          phone_number: "(+1)555-***-0104",
          full_address: "321 Elm St, Houston, TX 77001",
          address_line1: "321 Elm St",
          postal_code: "77001",
          region_code: "US",
        },
      },
      {
        id: "576461413038785005",
        status: "CANCELLED",
        create_time: Math.floor(Date.now() / 1000) - 259200,
        update_time: Math.floor(Date.now() / 1000) - 250000,
        buyer_nickname: "user213123",
        buyer_email: "v2b2V9@chat.seller.tiktok.com",
        payment: {
          total_amount: "5000",
          currency: "IDR",
          sub_total: "5000",
          shipping_fee: "5000",
          tax: "5000",
        },
        line_items: [
          {
            id: "577086512123755123",
            product_id: "1729582718312380123",
            product_name: "Women's Winter Crochet Clothes",
            sku_id: "2729382476852921560",
            seller_sku: "red_iphone_256",
            quantity: 1,
            sale_price: "0.01",
            currency: "IDR",
            display_status: "CANCELLED",
            package_status: "TO_FULFILL",
            sku_name: "Iphone",
          },
        ],
        fulfillment_type: "FULFILLMENT_BY_SELLER",
        recipient_address: {
          name: "David Kong",
          phone_number: "(+1)213-***-1234",
          full_address: "1199 Coleman Ave San Jose, CA 95110",
          address_line1: "TikTok 5800 bristol Pkwy",
          postal_code: "95110",
          region_code: "US",
        },
      },
    ],
  },
}
