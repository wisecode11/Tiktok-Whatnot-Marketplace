const Notification = require("../models/Notification");
const User = require("../models/Users");
const { emitToUser } = require("../socket/chatRealtime");

function createHttpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}

async function findLocalUser(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }

  return user;
}

function toDisplayName(user) {
  if (!user) {
    return "Someone";
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  if (user.email) {
    return String(user.email).split("@")[0];
  }

  return "Someone";
}

function serializeNotification(notification) {
  return {
    id: notification._id,
    type: notification.type,
    title: notification.title,
    body: notification.body,
    href: notification.href || null,
    metadata: notification.metadata || {},
    senderUserId: notification.sender_user_id || null,
    readAt: notification.read_at || null,
    createdAt: notification.created_at,
    isRead: Boolean(notification.read_at),
  };
}

function buildChatHref({ recipientRole, senderUserId }) {
  if (recipientRole === "moderator") {
    return `/moderator/chat?peer=${encodeURIComponent(String(senderUserId))}`;
  }

  return `/seller/chat?peer=${encodeURIComponent(String(senderUserId))}`;
}

function truncatePreview(value, maxLength = 120) {
  const normalized = typeof value === "string" ? value.trim() : "";

  if (!normalized) {
    return "Sent you a message";
  }

  if (normalized.length <= maxLength) {
    return normalized;
  }

  return `${normalized.slice(0, maxLength - 1)}…`;
}

async function createChatMessageNotification({
  recipientUserId,
  senderUser,
  threadId,
  messageId,
  preview,
}) {
  const sender = senderUser || null;
  const senderName = toDisplayName(sender);
  const recipient = await User.findById(recipientUserId).select("_id user_type");

  if (!recipient) {
    return null;
  }

  const recipientRole = recipient.user_type === "moderator" ? "moderator" : "streamer";
  const messagePreview = truncatePreview(preview);
  const now = new Date();

  const notification = new Notification({
    recipient_user_id: String(recipientUserId),
    sender_user_id: sender ? String(sender._id) : null,
    type: "chat_message",
    title: `New message from ${senderName}`,
    body: messagePreview,
    href: buildChatHref({
      recipientRole,
      senderUserId: sender ? sender._id : null,
    }),
    metadata: {
      threadId: String(threadId),
      messageId: String(messageId),
      senderName,
    },
    created_at: now,
  });

  await notification.save();

  const payload = serializeNotification(notification);
  emitToUser(recipientUserId, "notification:new", { notification: payload });

  return payload;
}

async function listNotifications({ clerkUserId, limit = 30 }) {
  const user = await findLocalUser(clerkUserId);
  const safeLimit = Math.min(100, Math.max(1, Number(limit) || 30));

  const notifications = await Notification.find({ recipient_user_id: user._id })
    .sort({ created_at: -1 })
    .limit(safeLimit);

  const unreadCount = await Notification.countDocuments({
    recipient_user_id: user._id,
    read_at: null,
  });

  return {
    notifications: notifications.map(serializeNotification),
    unreadCount,
  };
}

async function markNotificationRead({ clerkUserId, notificationId }) {
  const user = await findLocalUser(clerkUserId);
  const notification = await Notification.findOne({
    _id: notificationId,
    recipient_user_id: user._id,
  });

  if (!notification) {
    throw createHttpError(404, "Notification not found.");
  }

  if (!notification.read_at) {
    notification.read_at = new Date();
    await notification.save();
  }

  const unreadCount = await Notification.countDocuments({
    recipient_user_id: user._id,
    read_at: null,
  });

  return {
    notification: serializeNotification(notification),
    unreadCount,
  };
}

async function markAllNotificationsRead({ clerkUserId }) {
  const user = await findLocalUser(clerkUserId);
  const now = new Date();

  await Notification.updateMany(
    { recipient_user_id: user._id, read_at: null },
    { $set: { read_at: now } },
  );

  return { unreadCount: 0 };
}

module.exports = {
  createChatMessageNotification,
  listNotifications,
  markAllNotificationsRead,
  markNotificationRead,
  serializeNotification,
};
