let chatIo = null;

function setChatIo(io) {
  chatIo = io;
}

function getChatIo() {
  return chatIo;
}

function emitToUser(localUserId, event, payload) {
  if (!chatIo || !localUserId) {
    return;
  }

  chatIo.to(`user:${String(localUserId)}`).emit(event, payload);
}

module.exports = {
  setChatIo,
  getChatIo,
  emitToUser,
};
