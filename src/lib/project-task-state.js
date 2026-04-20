function normalizeId(value) {
  return value?.toString ? value.toString() : String(value || "");
}

function startOfDay(value) {
  const date = value instanceof Date ? new Date(value) : new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }

  date.setHours(0, 0, 0, 0);
  return date;
}

export function shouldActivateProject(startDate, startDateUndecided = false) {
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

export function recalculateProjectTaskState(tasks, options = {}) {
  const projectStarted = Boolean(options.projectStarted);
  const doneTaskIds = new Set(
    (tasks || [])
      .filter((task) => Boolean(task?.isDone))
      .map((task) => normalizeId(task?._id))
  );

  const nextTasks = (tasks || []).map((task) => {
    const taskId = normalizeId(task?._id);
    const dependsOnTaskIds = Array.isArray(task?.dependsOnTaskIds) ? task.dependsOnTaskIds : [];
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

  return nextTasks;
}

export function buildActiveTaskSnapshot(tasks) {
  return (tasks || [])
    .filter((task) => Boolean(task?.isActive))
    .map((task) => ({
      _id: normalizeId(task?._id),
      title: String(task?.title || "").trim(),
      taskNumber: String(task?.taskNumber || "").trim(),
      mainHeading: String(task?.mainHeading || "").trim(),
      subHeading: String(task?.subHeading || "").trim(),
      processes: String(task?.processes || "").trim(),
      spacesName: String(task?.spacesName || "").trim(),
      ownerCode: String(task?.ownerCode || "").trim(),
      assigneeName: String(task?.assigneeName || "").trim(),
      relationshipType: String(task?.relationshipType || "").trim(),
      status: String(task?.status || "").trim(),
      allottedDays: String(task?.allottedDays || "").trim(),
    }));
}
