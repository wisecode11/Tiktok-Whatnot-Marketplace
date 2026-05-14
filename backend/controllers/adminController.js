const {
  ModeratorOrderReview,
  User,
  ModeratorProfile,
  ModeratorBooking,
} = require("../models");

function sendError(res, error) {
  const status = error.status || 500;
  const payload = { error: error.message || "Unexpected error." };

  if (error.details) {
    payload.details = error.details;
  }

  return res.status(status).json(payload);
}

/**
 * Get all moderator reviews with pagination and filters
 */
async function getAllModeratorReviews(req, res) {
  try {
    const { page = 1, limit = 20, sortBy = "created_at", order = "desc", ratingFilter } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};
    if (ratingFilter) {
      query.rating = parseInt(ratingFilter);
    }

    const reviews = await ModeratorOrderReview.find(query)
      .sort({ [sortBy]: order === "desc" ? -1 : 1 })
      .skip(skip)
      .limit(parseInt(limit))
      .lean();

    // Populate user details
    const reviewsWithDetails = await Promise.all(
      reviews.map(async (review) => {
        const [moderator, streamer, booking] = await Promise.all([
          User.findById(review.moderator_user_id).select("first_name last_name email").lean(),
          User.findById(review.streamer_user_id).select("first_name last_name email").lean(),
          ModeratorBooking.findById(review.booking_id).select("booking_duration_minutes").lean(),
        ]);

        return {
          ...review,
          moderator,
          streamer,
          booking,
        };
      })
    );

    const total = await ModeratorOrderReview.countDocuments(query);

    return res.status(200).json({
      data: reviewsWithDetails,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * Get reviews for a specific user (moderator or streamer)
 */
async function getReviewsForUser(req, res) {
  try {
    const { userId } = req.params;
    const { type = "moderator" } = req.query; // 'moderator' or 'streamer'

    let query = {};
    if (type === "moderator") {
      query.moderator_user_id = userId;
    } else {
      query.streamer_user_id = userId;
    }

    const reviews = await ModeratorOrderReview.find(query)
      .sort({ created_at: -1 })
      .lean();

    const reviewsWithDetails = await Promise.all(
      reviews.map(async (review) => {
        const [moderator, streamer, booking] = await Promise.all([
          User.findById(review.moderator_user_id).select("first_name last_name email").lean(),
          User.findById(review.streamer_user_id).select("first_name last_name email").lean(),
          ModeratorBooking.findById(review.booking_id).select("booking_duration_minutes").lean(),
        ]);

        return {
          ...review,
          moderator,
          streamer,
          booking,
        };
      })
    );

    // Calculate stats
    const totalReviews = reviewsWithDetails.length;
    const averageRating =
      totalReviews > 0
        ? (reviewsWithDetails.reduce((sum, r) => sum + r.rating, 0) / totalReviews).toFixed(2)
        : 0;

    const ratingDistribution = {
      5: reviewsWithDetails.filter((r) => r.rating === 5).length,
      4: reviewsWithDetails.filter((r) => r.rating === 4).length,
      3: reviewsWithDetails.filter((r) => r.rating === 3).length,
      2: reviewsWithDetails.filter((r) => r.rating === 2).length,
      1: reviewsWithDetails.filter((r) => r.rating === 1).length,
    };

    return res.status(200).json({
      reviews: reviewsWithDetails,
      stats: {
        totalReviews,
        averageRating,
        ratingDistribution,
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * Get review statistics
 */
async function getReviewStats(req, res) {
  try {
    const totalReviews = await ModeratorOrderReview.countDocuments();
    const averageRating =
      totalReviews > 0
        ? (
            await ModeratorOrderReview.aggregate([
              {
                $group: {
                  _id: null,
                  avgRating: { $avg: "$rating" },
                },
              },
            ])
          )[0]?.avgRating || 0
        : 0;

    const ratingDistribution = await ModeratorOrderReview.aggregate([
      {
        $group: {
          _id: "$rating",
          count: { $sum: 1 },
        },
      },
      {
        $sort: { _id: -1 },
      },
    ]);

    const totalModerators = await User.countDocuments({ user_type: "moderator", status: "active" });
    const totalStreamers = await User.countDocuments({ user_type: "seller", status: "active" });

    return res.status(200).json({
      totalReviews,
      averageRating: parseFloat(averageRating.toFixed(2)),
      ratingDistribution: ratingDistribution.reduce(
        (acc, item) => {
          acc[item._id] = item.count;
          return acc;
        },
        {}
      ),
      totalModerators,
      totalStreamers,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * Get all user profiles with filters and pagination
 */
async function getUserProfiles(req, res) {
  try {
    const { page = 1, limit = 20, userType, status } = req.query;
    const skip = (parseInt(page) - 1) * parseInt(limit);

    let query = {};
    if (userType) query.user_type = userType;
    if (status) query.status = status;

    const users = await User.find(query)
      .select("_id email first_name last_name user_type status created_at updated_at")
      .skip(skip)
      .limit(parseInt(limit))
      .sort({ created_at: -1 })
      .lean();

    // Get profile details for each user
    const usersWithProfiles = await Promise.all(
      users.map(async (user) => {
        if (user.user_type === "moderator") {
          const profile = await ModeratorProfile.findOne({ user_id: user._id })
            .select("is_published rating_from_streamers")
            .lean();
          return { ...user, profile };
        }
        return { ...user, profile: null };
      })
    );

    const total = await User.countDocuments(query);

    return res.status(200).json({
      data: usersWithProfiles,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * Get user profile by ID
 */
async function getUserProfileById(req, res) {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId).lean();
    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    let profile = null;
    if (user.user_type === "moderator") {
      profile = await ModeratorProfile.findOne({ user_id: userId }).lean();

      // Get reviews for this moderator
      const reviews = await ModeratorOrderReview.find({ moderator_user_id: userId })
        .sort({ created_at: -1 })
        .limit(10)
        .lean();

      return res.status(200).json({
        user,
        profile,
        recentReviews: reviews,
      });
    }

    return res.status(200).json({
      user,
      profile: null,
      recentReviews: [],
    });
  } catch (error) {
    return sendError(res, error);
  }
}

/**
 * Update user status (active, suspended, deleted, etc.)
 */
async function updateUserStatus(req, res) {
  try {
    const { userId } = req.params;
    const { status, reason } = req.body;

    if (!["active", "inactive", "pending", "blocked", "deleted"].includes(status)) {
      return res.status(400).json({ error: "Invalid status" });
    }

    const user = await User.findByIdAndUpdate(
      userId,
      { status, updated_at: new Date() },
      { new: true }
    ).lean();

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    return res.status(200).json({
      message: "User status updated successfully",
      user,
    });
  } catch (error) {
    return sendError(res, error);
  }
}

module.exports = {
  getAllModeratorReviews,
  getReviewsForUser,
  getUserProfiles,
  getUserProfileById,
  updateUserStatus,
  getReviewStats,
};
