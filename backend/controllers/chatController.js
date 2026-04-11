const {
  listThreads,
  openThread,
  listMessages,
  sendMessage,
} = require("../services/chatService");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };

  if (error.details) {
    payload.details = error.details;
  }

  return res.status(status).json(payload);
}

async function getThreads(req, res) {
  try {
    const result = await listThreads({ clerkUserId: req.auth.userId });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function createOrOpenThread(req, res) {
  try {
    const result = await openThread({
      clerkUserId: req.auth.userId,
      peerUserId: req.body && req.body.peerUserId,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function getMessages(req, res) {
  try {
    const result = await listMessages({
      clerkUserId: req.auth.userId,
      threadId: req.params.threadId,
      limit: req.query && req.query.limit ? Number(req.query.limit) : undefined,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function postMessage(req, res) {
  try {
    const result = await sendMessage({
      clerkUserId: req.auth.userId,
      threadId: req.params.threadId,
      body: req.body && req.body.body,
    });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  createOrOpenThread,
  getMessages,
  getThreads,
  postMessage,
};
