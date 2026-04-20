const { loadEnvConfig } = require("@next/env");
const { MongoClient } = require("mongodb");

loadEnvConfig(process.cwd());

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

function shouldActivateProject(startDate, startDateUndecided = false) {
  if (startDateUndecided || !startDate) {
    return false;
  }

  const normalizedStartDate = startOfDay(startDate);
  if (!normalizedStartDate) {
    return false;
  }

  const today = startOfDay(new Date());
  return Boolean(today && normalizedStartDate.getTime() <= today.getTime());
}

function normalizeId(value) {
  return value && typeof value.toString === "function" ? value.toString() : String(value || "");
}

function recalculateProjectTaskState(tasks, projectStarted) {
  const doneTaskIds = new Set(
    (tasks || [])
      .filter((task) => Boolean(task && task.isDone))
      .map((task) => normalizeId(task && task._id))
  );

  return (tasks || []).map((task) => {
    const taskId = normalizeId(task && task._id);
    const dependsOnTaskIds = Array.isArray(task && task.dependsOnTaskIds) ? task.dependsOnTaskIds : [];
    const isDone = doneTaskIds.has(taskId);
    const dependenciesSatisfied =
      dependsOnTaskIds.length === 0 ||
      dependsOnTaskIds.every((dependencyId) => doneTaskIds.has(normalizeId(dependencyId)));

    return {
      ...task,
      isDone,
      isActive: projectStarted && !isDone && dependenciesSatisfied,
    };
  });
}

function buildActiveTaskSnapshot(tasks) {
  return (tasks || [])
    .filter((task) => Boolean(task && task.isActive))
    .map((task) => ({
      _id: normalizeId(task && task._id),
      title: String((task && task.title) || "").trim(),
      taskNumber: String((task && task.taskNumber) || "").trim(),
      mainHeading: String((task && task.mainHeading) || "").trim(),
      subHeading: String((task && task.subHeading) || "").trim(),
      processes: String((task && task.processes) || "").trim(),
      spacesName: String((task && task.spacesName) || "").trim(),
      ownerCode: String((task && task.ownerCode) || "").trim(),
      assigneeName: String((task && task.assigneeName) || "").trim(),
      relationshipType: String((task && task.relationshipType) || "").trim(),
      status: String((task && task.status) || "").trim(),
      allottedDays: String((task && task.allottedDays) || "").trim(),
    }));
}

async function main() {
  const uri = process.env.MONGODB_URI;
  const databaseName = process.env.MONGODB_DATABASE_NAME;

  if (!uri || !databaseName) {
    throw new Error("MONGODB_URI and MONGODB_DATABASE_NAME are required");
  }

  const client = new MongoClient(uri, {
    tls: String(process.env.MONGODB_SSL || "false").toLowerCase() === "true",
    readPreference: process.env.MONGODB_READ_PREFERENCE || "primary",
    serverSelectionTimeoutMS: 15000,
  });

  await client.connect();

  try {
    const db = client.db(databaseName);
    const projects = await db.collection("fms_projects").find({}).toArray();

    let updatedProjects = 0;
    let updatedBundles = 0;

    for (const project of projects) {
      const bundle = await db.collection("fms_project_task_bundles").findOne({ projectId: project._id });
      if (!bundle || !Array.isArray(bundle.tasks)) {
        continue;
      }

      const projectStarted = shouldActivateProject(project.startDate, project.startDateUndecided);
      const nextTasks = recalculateProjectTaskState(bundle.tasks, projectStarted);
      const activeTaskSnapshot = buildActiveTaskSnapshot(nextTasks);
      const now = new Date();

      await Promise.all([
        db.collection("fms_project_task_bundles").updateOne(
          { projectId: project._id },
          {
            $set: {
              tasks: nextTasks,
              totalTasks: nextTasks.length,
              updatedAt: now,
            },
          }
        ),
        db.collection("fms_projects").updateOne(
          { _id: project._id },
          {
            $set: {
              totalTasks: nextTasks.length,
              active_task: activeTaskSnapshot,
              updatedAt: now,
            },
          }
        ),
      ]);

      updatedProjects += 1;
      updatedBundles += 1;
    }

    console.log(
      JSON.stringify(
        {
          databaseName,
          totalProjects: projects.length,
          updatedProjects,
          updatedBundles,
        },
        null,
        2
      )
    );
  } finally {
    await client.close().catch(() => {});
  }
}

main().catch((error) => {
  console.error(error && error.stack ? error.stack : String(error));
  process.exit(1);
});
