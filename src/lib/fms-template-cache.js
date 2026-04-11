import { deleteCachePattern, getCache, setCache } from "@/lib/redis";
import { serializeTask, serializeTemplate } from "@/lib/fms-template";
import { ObjectId } from "mongodb";

const FMS_TEMPLATE_LIST_CACHE_KEY = "fms:templates:list";
const FMS_TEMPLATE_LIST_TTL_SECONDS = 60 * 10;
const FMS_TEMPLATE_BUNDLE_TTL_SECONDS = 60 * 10;

function getTemplateBundleCacheKey(templateId) {
  return `fms:template:${templateId}:bundle`;
}

export async function getCachedTemplateList() {
  return getCache(FMS_TEMPLATE_LIST_CACHE_KEY);
}

export async function setCachedTemplateList(payload) {
  return setCache(FMS_TEMPLATE_LIST_CACHE_KEY, payload, FMS_TEMPLATE_LIST_TTL_SECONDS);
}

export async function syncTemplateListCache(db) {
  const templates = await db
    .collection("fms_templates")
    .find(
      {},
      {
        projection: {
          name: 1,
          sourceFileName: 1,
          sheetName: 1,
          totalTasks: 1,
          importedAt: 1,
          updatedAt: 1,
        },
      }
    )
    .sort({ importedAt: -1 })
    .limit(20)
    .toArray();

  const latestTemplate = templates[0] ? serializeTemplate(templates[0]) : null;
  const payload = {
    templates: templates.map(serializeTemplate),
    latestTemplate,
  };

  await setCachedTemplateList(payload);
  return payload;
}

export async function getCachedTemplateBundle(templateId) {
  return getCache(getTemplateBundleCacheKey(templateId));
}

export async function setCachedTemplateBundle(templateId, payload) {
  return setCache(
    getTemplateBundleCacheKey(templateId),
    payload,
    FMS_TEMPLATE_BUNDLE_TTL_SECONDS
  );
}

export async function syncTemplateBundleCache(db, templateId) {
  const _id = typeof templateId === "string" ? new ObjectId(templateId) : templateId;

  const template = await db.collection("fms_templates").findOne({ _id });
  if (!template) {
    return null;
  }

  const tasks = await db
    .collection("fms_template_tasks")
    .find({ templateId: _id })
    .sort({ rowNumber: 1 })
    .toArray();

  const payload = {
    template: serializeTemplate(template),
    tasks: tasks.map(serializeTask),
  };

  await setCachedTemplateBundle(_id.toString(), payload);
  return payload;
}

export async function invalidateTemplateBundleCache(templateId) {
  return deleteCachePattern(`fms:template:${templateId}:*`);
}

export {
  FMS_TEMPLATE_LIST_CACHE_KEY,
  getTemplateBundleCacheKey,
};
