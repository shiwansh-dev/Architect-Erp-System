import type { MongoClient } from "mongodb";

declare const clientPromise: Promise<MongoClient>;
export default clientPromise;
export const databaseName: string;
