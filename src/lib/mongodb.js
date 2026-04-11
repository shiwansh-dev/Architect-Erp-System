// src/lib/mongodb.js
import { MongoClient } from 'mongodb';

// MongoDB connection string and database name from environment variables
const uri = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING;
const databaseName = process.env.MONGODB_DATABASE_NAME || "ERP";

if (!uri) {
  throw new Error(
    "Please define MONGODB_URI or MONGODB_CONNECTION_STRING environment variable in .env.local"
  );
}

const options = {
  ssl: process.env.MONGODB_SSL === 'true' || false,
  readPreference: process.env.MONGODB_READ_PREFERENCE || 'primary'
};

let cachedPromise = null;

// Lazily connect only when awaited (prevents network calls during build)
const clientPromise = {
  then: (resolve, reject) => {
    if (!cachedPromise) {
      const client = new MongoClient(uri, options);
      cachedPromise = client.connect();
    }
    return cachedPromise.then(resolve, reject);
  },
};

// Export both the client promise (thenable) and database name
export default clientPromise;
export { databaseName };
