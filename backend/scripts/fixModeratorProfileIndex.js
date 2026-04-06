/**
 * Migration script to fix E11000 duplicate key error for moderatorprofiles
 * 
 * Issue: Multiple documents have public_slug: null which violates the unique constraint
 * Solution: 
 *   1. Drop the old non-sparse unique index
 *   2. Keep only one profile with null public_slug per user
 *   3. Create a new sparse unique index that ignores null values
 */

const mongoose = require("mongoose");
const { connectDB } = require("../config/db");

async function fixModeratorProfileIndex() {
  try {
    console.log("🔧 Starting migration: Fixing ModeratorProfile index...\n");

    // Connect to database
    const mongoUri = process.env.MONGODB_URI || "mongodb://localhost:27017/sellerhub";
    await connectDB(mongoUri);
    console.log("✅ Connected to database\n");

    const db = mongoose.connection;
    const collection = db.collection("moderatorprofiles");

    // Step 1: Drop the old non-sparse index
    console.log("📋 Checking existing indexes...");
    const indexes = await collection.getIndexes();
    console.log("Existing indexes:", Object.keys(indexes));

    const oldIndexName = "public_slug_1";
    if (indexes[oldIndexName]) {
      console.log(`\n🗑️  Dropping old index: ${oldIndexName}`);
      await collection.dropIndex(oldIndexName);
      console.log("✅ Old index dropped\n");
    } else {
      console.log(`✓ Index ${oldIndexName} already removed\n`);
    }

    // Step 2: Find and fix duplicates with null public_slug
    console.log("🔍 Finding documents with null public_slug...");
    const nullSlugDocs = await collection.find({ public_slug: null }).toArray();
    console.log(`Found ${nullSlugDocs.length} documents with null public_slug\n`);

    if (nullSlugDocs.length > 1) {
      console.log("⚠️  Found multiple documents with null public_slug. Keeping one per user...\n");

      // Group by user_id to find duplicates
      const userMap = new Map();
      const docsToDelete = [];

      for (const doc of nullSlugDocs) {
        const userId = doc.user_id;
        if (userMap.has(userId)) {
          // This is a duplicate - mark for deletion
          docsToDelete.push(doc._id);
          console.log(`   - Marking duplicate profile for user ${userId} (ID: ${doc._id}) for deletion`);
        } else {
          userMap.set(userId, doc._id);
          console.log(`   - Keeping profile for user ${userId} (ID: ${doc._id})`);
        }
      }

      if (docsToDelete.length > 0) {
        console.log(`\n🗑️  Deleting ${docsToDelete.length} duplicate profile(s)...`);
        const result = await collection.deleteMany({ _id: { $in: docsToDelete } });
        console.log(`✅ Deleted ${result.deletedCount} duplicate profile(s)\n`);
      }
    }

    // Step 3: Create new sparse index
    console.log("🔨 Creating new sparse unique index...");
    await collection.createIndex(
      { public_slug: 1 },
      { unique: true, sparse: true, name: "public_slug_1" }
    );
    console.log("✅ New sparse unique index created\n");

    // Verify the fix
    console.log("🔍 Verifying fix...");
    const allDocs = await collection.find({}).toArray();
    const nullCount = await collection.countDocuments({ public_slug: null });
    const publishedCount = await collection.countDocuments({ public_slug: { $ne: null } });

    console.log(`Total moderator profiles: ${allDocs.length}`);
    console.log(`  - With null slug: ${nullCount}`);
    console.log(`  - With published slug: ${publishedCount}`);

    const finalIndexes = await collection.getIndexes();
    console.log(`\nFinal indexes:`, Object.keys(finalIndexes));

    console.log("\n✨ Migration completed successfully!");
    process.exit(0);
  } catch (error) {
    console.error("\n❌ Migration failed:", error.message);
    console.error(error);
    process.exit(1);
  }
}

// Run the migration
fixModeratorProfileIndex();
