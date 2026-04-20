const { MongoClient } = require("mongodb");

const uri =
  process.env.FMS_TEMPLATE_MONGODB_URI ||
  process.env.MONGODB_URI ||
  "mongodb://cmc1uz1nt00019yt22i2wgjkn:sYbp6IBr4UyA5u4cuiqZ1iFl@62.171.177.91:27017/?readPreference=primary&ssl=false";
const databaseName = process.env.FMS_TEMPLATE_MONGODB_DATABASE_NAME || "fms_templates";

async function main() {
  const client = new MongoClient(uri, {
    ssl: false,
    readPreference: "primary",
  });

  try {
    await client.connect();
    const db = client.db(databaseName);
    const projects = await db
      .collection("fms_projects")
      .find(
        {},
        {
          projection: {
            _id: 1,
            totalTasks: 1,
          },
        }
      )
      .toArray();

    let migratedProjects = 0;
    let skippedProjects = 0;
    let totalTasks = 0;

    for (const project of projects) {
      const projectId = project._id;
      const existingBundle = await db.collection("fms_project_task_bundles").findOne(
        { projectId },
        { projection: { _id: 1 } }
      );

      if (existingBundle) {
        skippedProjects += 1;
        continue;
      }

      const tasks = await db
        .collection("fms_project_tasks")
        .find({ projectId })
        .sort({ rowNumber: 1 })
        .toArray();

      if (!tasks.length) {
        skippedProjects += 1;
        continue;
      }

      const now = new Date();
      await db.collection("fms_project_task_bundles").insertOne({
        projectId,
        totalTasks: tasks.length,
        tasks,
        createdAt: now,
        updatedAt: now,
      });

      migratedProjects += 1;
      totalTasks += tasks.length;
    }

    console.log(
      JSON.stringify(
        {
          databaseName,
          scannedProjects: projects.length,
          migratedProjects,
          skippedProjects,
          totalTasksMigrated: totalTasks,
        },
        null,
        2
      )
    );
  } finally {
    await client.close();
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
