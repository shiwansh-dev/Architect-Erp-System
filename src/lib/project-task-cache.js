import { deleteCache, getCache, setCache } from "@/lib/redis";

const PROJECT_TASK_CACHE_TTL_SECONDS = 60 * 30;

function getProjectTaskCacheKey(projectId) {
  return `projects:${projectId}:tasks`;
}

export async function getCachedProjectTasks(projectId) {
  return getCache(getProjectTaskCacheKey(projectId));
}

export async function setCachedProjectTasks(projectId, tasks) {
  return setCache(getProjectTaskCacheKey(projectId), tasks, PROJECT_TASK_CACHE_TTL_SECONDS);
}

export async function deleteCachedProjectTasks(projectId) {
  return deleteCache(getProjectTaskCacheKey(projectId));
}

export { getProjectTaskCacheKey, PROJECT_TASK_CACHE_TTL_SECONDS };
