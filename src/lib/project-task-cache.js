import { deleteCache, getCache, setCache } from "@/lib/redis";

const PROJECT_TASK_CACHE_TTL_SECONDS = 60 * 30;

function getProjectTaskCacheKey(projectId) {
  return `projects:${projectId}:tasks`;
}

function normalizeUpdatedAt(value) {
  if (!value) {
    return null;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  const parsed = new Date(value);
  return Number.isNaN(parsed.getTime()) ? null : parsed.toISOString();
}

export async function getCachedProjectTaskBundle(projectId) {
  const cachedValue = await getCache(getProjectTaskCacheKey(projectId));

  if (Array.isArray(cachedValue)) {
    return {
      tasks: cachedValue,
      updatedAt: null,
    };
  }

  if (cachedValue && typeof cachedValue === "object" && Array.isArray(cachedValue.tasks)) {
    return {
      tasks: cachedValue.tasks,
      updatedAt: normalizeUpdatedAt(cachedValue.updatedAt),
    };
  }

  return null;
}

export async function getCachedProjectTasks(projectId) {
  const cachedBundle = await getCachedProjectTaskBundle(projectId);
  return cachedBundle?.tasks || null;
}

export async function setCachedProjectTasks(projectId, tasks, updatedAt = null) {
  return setCache(
    getProjectTaskCacheKey(projectId),
    {
      tasks,
      updatedAt: normalizeUpdatedAt(updatedAt),
    },
    PROJECT_TASK_CACHE_TTL_SECONDS
  );
}

export async function deleteCachedProjectTasks(projectId) {
  return deleteCache(getProjectTaskCacheKey(projectId));
}

export { getProjectTaskCacheKey, PROJECT_TASK_CACHE_TTL_SECONDS, normalizeUpdatedAt };
