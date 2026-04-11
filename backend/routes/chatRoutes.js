const express = require("express");

const {
  createOrOpenThread,
  getMessages,
  getThreads,
  postMessage,
} = require("../controllers/chatController");
const { authenticateRequest } = require("../middleware/authenticate");

const router = express.Router();

router.get("/threads", authenticateRequest, getThreads);
router.post("/threads", authenticateRequest, createOrOpenThread);
router.get("/threads/:threadId/messages", authenticateRequest, getMessages);
router.post("/threads/:threadId/messages", authenticateRequest, postMessage);

module.exports = router;
