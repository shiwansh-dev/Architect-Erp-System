import { MongoClient } from "mongodb";

const uri =
  process.env.FMS_TEMPLATE_MONGODB_URI ||
  "mongodb://cmc1uz1nt00019yt22i2wgjkn:sYbp6IBr4UyA5u4cuiqZ1iFl@62.171.177.91:27017/?readPreference=primary&ssl=false";

const databaseName = process.env.FMS_TEMPLATE_MONGODB_DATABASE_NAME || "fms_templates";

if (!uri) {
  throw new Error("Missing FMS template MongoDB connection string");
}

let cachedPromise = null;
let ensuredIndexesPromise = null;

async function ensureIndexes(client) {
  if (!ensuredIndexesPromise) {
    ensuredIndexesPromise = (async () => {
      const db = client.db(databaseName);
      await Promise.all([
        db.collection("fms_templates").createIndex({ importedAt: -1 }),
        db.collection("fms_template_tasks").createIndex({ templateId: 1, rowNumber: 1 }),
      ]);
    })().catch((error) => {
      ensuredIndexesPromise = null;
      throw error;
    });
  }

  return ensuredIndexesPromise;
}

const clientPromise = {
  then: (resolve, reject) => {
    if (!cachedPromise) {
      const client = new MongoClient(uri, {
        ssl: false,
        readPreference: "primary",
      });
      cachedPromise = client.connect().then(async (connectedClient) => {
        await ensureIndexes(connectedClient);
        return connectedClient;
      });
    }

    return cachedPromise.then(resolve, reject);
  },
};

export default clientPromise;
export { databaseName };
