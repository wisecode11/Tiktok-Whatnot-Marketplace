const ChatMessage = require("../models/ChatMessage");
const ChatThread = require("../models/ChatThread");
const ModeratorBooking = require("../models/ModeratorBooking");
const User = require("../models/Users");

const MAX_MESSAGE_LENGTH = 2000;

function createHttpError(status, message, details) {
  const error = new Error(message);
  error.status = status;
  if (details) {
    error.details = details;
  }
  return error;
}

async function findLocalUser(clerkUserId) {
  const user = await User.findOne({ clerk_user_id: clerkUserId });

  if (!user) {
    throw createHttpError(404, "User account was not found.");
  }

  return user;
}

function normalizeRole(userType) {
  if (userType === "seller") {
    return "streamer";
  }

  if (userType === "moderator") {
    return "moderator";
  }

  return null;
}

function toDisplayName(user) {
  if (!user) {
    return "Unknown user";
  }

  const fullName = [user.first_name, user.last_name].filter(Boolean).join(" ").trim();
  if (fullName) {
    return fullName;
  }

  if (user.email) {
    return String(user.email).split("@")[0];
  }

  return "Unknown user";
}

function serializeThread({ thread, currentUserId, currentRole, peer, lastMessage }) {
  const isStreamer = currentRole === "streamer";
  const readAt = isStreamer ? thread.seller_last_read_at : thread.moderator_last_read_at;
  const unreadCount = lastMessage && String(lastMessage.sender_user_id) !== String(currentUserId)
    && (!readAt || new Date(lastMessage.created_at).getTime() > new Date(readAt).getTime())
    ? 1
    : 0;

  return {
    id: thread._id,
    peer: {
      userId: peer ? peer._id : null,
      role: isStreamer ? "moderator" : "streamer",
      name: toDisplayName(peer),
      email: peer && peer.email ? String(peer.email).toLowerCase() : null,
    },
    lastMessage: {
      body: lastMessage ? lastMessage.body : thread.last_message_preview || null,
      at: lastMessage ? lastMessage.created_at : thread.last_message_at || null,
      senderUserId: lastMessage ? lastMessage.sender_user_id : null,
    },
    unreadCount,
    updatedAt: thread.updated_at || null,
  };
}

function serializeMessage(message) {
  return {
    id: message._id,
    threadId: message.thread_id,
    senderUserId: message.sender_user_id,
    body: message.body,
    createdAt: message.created_at,
  };
}

async function ensureAllowedPairing({ currentUser, peerUserId }) {
  if (!peerUserId) {
    throw createHttpError(400, "peerUserId is required.");
  }

  const peer = await User.findById(peerUserId);

  if (!peer) {
    throw createHttpError(404, "Peer user not found.");
  }

  const currentRole = normalizeRole(currentUser.user_type);
  const peerRole = normalizeRole(peer.user_type);

  if (!currentRole || !peerRole) {
    throw createHttpError(403, "Only streamer and moderator accounts can use this chat.");
  }

  if (currentRole === peerRole) {
    throw createHttpError(400, "Chat is only available between streamer and moderator.");
  }

  const sellerId = currentRole === "streamer" ? currentUser._id : peer._id;
  const moderatorId = currentRole === "moderator" ? currentUser._id : peer._id;

  const booking = await ModeratorBooking.findOne({
    requester_user_id: sellerId,
    moderator_user_id: moderatorId,
  }).select("_id");

  if (!booking) {
    throw createHttpError(403, "Chat is available only for streamer and moderator pairs with bookings.");
  }

  return {
    sellerId,
    moderatorId,
    peer,
    currentRole,
  };
}

async function ensureThreadAccess({ threadId, user }) {
  const thread = await ChatThread.findById(threadId);

  if (!thread) {
    throw createHttpError(404, "Chat thread not found.");
  }

  const isSeller = String(thread.seller_user_id) === String(user._id);
  const isModerator = String(thread.moderator_user_id) === String(user._id);

  if (!isSeller && !isModerator) {
    throw createHttpError(403, "You do not have access to this chat thread.");
  }

  return {
    thread,
    currentRole: isSeller ? "streamer" : "moderator",
  };
}

async function listThreads({ clerkUserId }) {
  const user = await findLocalUser(clerkUserId);
  const role = normalizeRole(user.user_type);

  if (!role) {
    throw createHttpError(403, "Only streamer and moderator accounts can use this chat.");
  }

  const filter = role === "streamer"
    ? { seller_user_id: user._id }
    : { moderator_user_id: user._id };

  const threads = await ChatThread.find(filter)
    .sort({ last_message_at: -1, updated_at: -1 })
    .limit(200);

  if (!threads.length) {
    return { threads: [] };
  }

  const peerIds = threads.map((thread) => (
    role === "streamer" ? String(thread.moderator_user_id) : String(thread.seller_user_id)
  ));

  const [peers, messages] = await Promise.all([
    User.find({ _id: { $in: peerIds } }).select("_id first_name last_name email user_type"),
    ChatMessage.find({ thread_id: { $in: threads.map((thread) => thread._id) } })
      .sort({ created_at: -1 })
      .limit(500),
  ]);

  const peerById = new Map(peers.map((peer) => [String(peer._id), peer]));
  const lastMessageByThreadId = new Map();

  for (const message of messages) {
    const key = String(message.thread_id);

    if (!lastMessageByThreadId.has(key)) {
      lastMessageByThreadId.set(key, message);
    }
  }

  return {
    threads: threads.map((thread) => {
      const peerId = role === "streamer" ? String(thread.moderator_user_id) : String(thread.seller_user_id);
      return serializeThread({
        thread,
        currentUserId: user._id,
        currentRole: role,
        peer: peerById.get(peerId) || null,
        lastMessage: lastMessageByThreadId.get(String(thread._id)) || null,
      });
    }),
  };
}

async function openThread({ clerkUserId, peerUserId }) {
  const user = await findLocalUser(clerkUserId);
  const pairing = await ensureAllowedPairing({
    currentUser: user,
    peerUserId,
  });

  const now = new Date();
  let thread = await ChatThread.findOne({
    seller_user_id: pairing.sellerId,
    moderator_user_id: pairing.moderatorId,
  });

  if (!thread) {
    thread = new ChatThread({
      seller_user_id: pairing.sellerId,
      moderator_user_id: pairing.moderatorId,
      last_message_preview: "",
      last_message_at: now,
      created_at: now,
      updated_at: now,
    });
    await thread.save();
  }

  return {
    thread: serializeThread({
      thread,
      currentUserId: user._id,
      currentRole: pairing.currentRole,
      peer: pairing.peer,
      lastMessage: null,
    }),
  };
}

async function listMessages({ clerkUserId, threadId, limit = 50 }) {
  const user = await findLocalUser(clerkUserId);
  const access = await ensureThreadAccess({ threadId, user });

  const safeLimit = Math.min(200, Math.max(1, Number(limit) || 50));
  const messages = await ChatMessage.find({ thread_id: access.thread._id })
    .sort({ created_at: -1 })
    .limit(safeLimit);

  const now = new Date();
  if (access.currentRole === "streamer") {
    access.thread.seller_last_read_at = now;
  } else {
    access.thread.moderator_last_read_at = now;
  }
  access.thread.updated_at = now;
  await access.thread.save();

  return {
    threadId: access.thread._id,
    messages: messages.reverse().map(serializeMessage),
  };
}

async function sendMessage({ clerkUserId, threadId, body }) {
  const user = await findLocalUser(clerkUserId);
  const access = await ensureThreadAccess({ threadId, user });

  const normalizedBody = typeof body === "string" ? body.trim() : "";

  if (!normalizedBody) {
    throw createHttpError(400, "Message body is required.");
  }

  if (normalizedBody.length > MAX_MESSAGE_LENGTH) {
    throw createHttpError(400, `Message cannot exceed ${MAX_MESSAGE_LENGTH} characters.`);
  }

  const now = new Date();
  const message = new ChatMessage({
    thread_id: access.thread._id,
    sender_user_id: user._id,
    body: normalizedBody,
    created_at: now,
  });

  await message.save();

  access.thread.last_message_preview = normalizedBody.slice(0, 280);
  access.thread.last_message_at = now;
  access.thread.updated_at = now;

  if (access.currentRole === "streamer") {
    access.thread.seller_last_read_at = now;
  } else {
    access.thread.moderator_last_read_at = now;
  }

  await access.thread.save();

  return {
    message: serializeMessage(message),
  };
}

module.exports = {
  listThreads,
  openThread,
  listMessages,
  sendMessage,
};
