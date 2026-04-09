// Model registry
module.exports = {
  // Core
  User: require('./Users'),
  SellerWorkspace: require('./SellerWorkspace'),
  WorkspaceMembership: require('./WorkspaceMembership'),
  ConnectedAccount: require('./ConnectedAccount'),

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
  KycVerification: require('./KycVerification'),
  StripeConnectAccount: require('./StripeConnectAccount'),
};
