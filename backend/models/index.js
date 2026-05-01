// Model registry
module.exports = {
  // Core
  User: require('./Users'),
  SellerWorkspace: require('./SellerWorkspace'),
  WorkspaceMembership: require('./WorkspaceMembership'),
  ConnectedAccount: require('./ConnectedAccount'),
  GetSessionApiData: require('./GetSessionApiData'),
  SellerSession: require('./SellerSession'),
  WhatnotOrder: require('./WhatnotOrder'),
  WhatnotInventorySnapshot: require('./WhatnotInventorySnapshot'),
  WhatnotCategory: require('./WhatnotCategory'),
  WhatnotSubCategory: require('./WhatnotSubCategory'),
  WhatnotHazmatType: require('./WhatnotHazmatType'),
  WhatnotProfileShipping: require('./WhatnotProfileShipping'),
  TikTokPost: require('./TikTokPost'),

  // Billing / Subscription
  SubscriptionInvoice: require('./SubscriptionInvoice'),
  WorkspaceSubscription: require('./WorkspaceSubscription'),
  SubscriptionPlan: require('./SubscriptionPlan'),
  SubscriptionPayment: require('./SubscriptionPayment'),

  // Moderator features
  ModeratorProfile: require('./ModeratorProfile'),
  ModeratorSchedule: require('./ModeratorSchedule'),
  ModeratorBooking: require('./ModeratorBooking'),
  ModeratorPayout: require('./ModeratorPayout'),
  ModeratorOrderReview: require('./ModeratorOrderReview'),
  KycVerification: require('./KycVerification'),
  StripeConnectAccount: require('./StripeConnectAccount'),

  // Team chat
  ChatThread: require('./ChatThread'),
  ChatMessage: require('./ChatMessage'),
};
