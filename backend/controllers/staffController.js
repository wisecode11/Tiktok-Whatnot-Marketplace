const { createStaffMember, listStaffMembers } = require("../services/staffService");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };

  if (error.details) {
    payload.details = error.details;
  }

  return res.status(status).json(payload);
}

async function listStaff(req, res) {
  try {
    const result = await listStaffMembers({ clerkUserId: req.auth.userId });
    return res.status(200).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

async function createStaff(req, res) {
  try {
    const result = await createStaffMember({
      clerkUserId: req.auth.userId,
      username: req.body && req.body.username,
      email: req.body && req.body.email,
      password: req.body && req.body.password,
    });

    return res.status(201).json(result);
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  createStaff,
  listStaff,
};