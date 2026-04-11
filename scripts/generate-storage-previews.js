const { S3Client, ListObjectsV2Command, HeadObjectCommand, GetObjectCommand } = require("@aws-sdk/client-s3");
const { MongoClient } = require("mongodb");
const ffmpeg = require("fluent-ffmpeg");
const ffmpegStatic = require("ffmpeg-static");
const ffprobeStatic = require("ffprobe-static");
const fs = require("node:fs");
const fsp = require("node:fs/promises");
const path = require("node:path");
const { tmpdir } = require("node:os");
const { pipeline } = require("node:stream/promises");

const DEFAULT_MAX = 0;
const MAX_PREVIEW_SIZE = 320;

function loadEnvFile() {
  const envPath = path.join(process.cwd(), ".env.local");
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, "utf8");
  content.split(/\r?\n/).forEach((line) => {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) return;
    const eqIndex = trimmed.indexOf("=");
    if (eqIndex === -1) return;
    const key = trimmed.slice(0, eqIndex).trim();
    let value = trimmed.slice(eqIndex + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
      value = value.slice(1, -1);
    }
    if (!process.env[key]) {
      process.env[key] = value;
    }
  });
}

function readEnv() {
  let accountId =
    process.env.CLOUDFLARE_R2_ACCOUNT_ID ||
    process.env.CLOUDFLARE_ACCOUNT_ID ||
    process.env.R2_ACCOUNT_ID ||
    null;
  let endpoint =
    process.env.CLOUDFLARE_R2_ENDPOINT ||
    process.env.R2_ENDPOINT ||
    process.env.R2_CUSTOM_ENDPOINT ||
    null;
  const accessKeyId =
    process.env.CLOUDFLARE_R2_ACCESS_KEY_ID ||
    process.env.R2_ACCESS_KEY_ID ||
    process.env.AWS_ACCESS_KEY_ID ||
    "";
  const secretAccessKey =
    process.env.CLOUDFLARE_R2_SECRET_ACCESS_KEY ||
    process.env.R2_SECRET_ACCESS_KEY ||
    process.env.AWS_SECRET_ACCESS_KEY ||
    "";
  let bucket = process.env.CLOUDFLARE_R2_BUCKET || process.env.R2_BUCKET || "";
  const keyPrefixRaw =
    process.env.CLOUDFLARE_R2_PHOTO_PREFIX ||
    process.env.R2_PHOTO_PREFIX ||
    process.env.CLOUDFLARE_R2_PREFIX ||
    "media/";

  if (endpoint) {
    const match = endpoint.match(/https?:\/\/([^\.]+)\.([a-z0-9]+)\.r2\.cloudflarestorage\.com/i);
    if (match) {
      const [, bucketFromEndpoint, accountFromEndpoint] = match;
      if (!bucket) bucket = bucketFromEndpoint;
      if (!accountId) accountId = accountFromEndpoint;
      endpoint = `https://${accountFromEndpoint}.r2.cloudflarestorage.com`;
    }
  }

  const missing = [];
  if (!accountId && !endpoint) missing.push("CLOUDFLARE_R2_ACCOUNT_ID or CLOUDFLARE_R2_ENDPOINT");
  if (!accessKeyId) missing.push("CLOUDFLARE_R2_ACCESS_KEY_ID");
  if (!secretAccessKey) missing.push("CLOUDFLARE_R2_SECRET_ACCESS_KEY");
  if (!bucket) missing.push("CLOUDFLARE_R2_BUCKET");
  if (missing.length) {
    throw new Error(`Missing R2 env vars: ${missing.join(", ")}`);
  }

  return {
    accountId,
    endpoint,
    accessKeyId,
    secretAccessKey,
    bucket,
    keyPrefix: keyPrefixRaw || "",
  };
}

function createClient(config) {
  return new S3Client({
    region: "auto",
    endpoint: config.endpoint || `https://${config.accountId}.r2.cloudflarestorage.com`,
    credentials: {
      accessKeyId: config.accessKeyId,
      secretAccessKey: config.secretAccessKey,
    },
  });
}

async function listAllKeys(client, config) {
  const keys = [];
  let cursor = undefined;
  do {
    const response = await client.send(
      new ListObjectsV2Command({
        Bucket: config.bucket,
        Prefix: config.keyPrefix || undefined,
        ContinuationToken: cursor,
      })
    );
    if (response.Contents) {
      response.Contents.forEach((item) => {
        if (item.Key) keys.push(item.Key);
      });
    }
    cursor = response.IsTruncated ? response.NextContinuationToken : undefined;
  } while (cursor);
  return keys;
}

async function ensureFfmpeg() {
  const ffmpegPath = ffmpegStatic || ffmpegStatic?.path;
  const ffprobePath = ffprobeStatic?.path;
  if (!ffmpegPath || !ffprobePath) {
    throw new Error("ffmpeg/ffprobe not available; install ffmpeg-static and ffprobe-static.");
  }
  ffmpeg.setFfmpegPath(ffmpegPath);
  ffmpeg.setFfprobePath(ffprobePath);
}

async function downloadObject(client, config, key, destPath) {
  const response = await client.send(
    new GetObjectCommand({
      Bucket: config.bucket,
      Key: key,
    })
  );
  if (!response.Body || typeof response.Body.pipe !== "function") {
    throw new Error("Missing object body");
  }
  await pipeline(response.Body, fs.createWriteStream(destPath));
}

async function generateImagePreview(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .outputOptions([
        "-frames:v 1",
        `-vf scale='min(${MAX_PREVIEW_SIZE},iw)':'min(${MAX_PREVIEW_SIZE},ih)':force_original_aspect_ratio=decrease`,
        "-q:v 30",
      ])
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

async function generateVideoPreview(inputPath, outputPath) {
  return new Promise((resolve, reject) => {
    ffmpeg(inputPath)
      .seekInput(1)
      .outputOptions([
        "-frames:v 1",
        `-vf scale='min(${MAX_PREVIEW_SIZE},iw)':'min(${MAX_PREVIEW_SIZE},ih)':force_original_aspect_ratio=decrease`,
        "-q:v 30",
      ])
      .output(outputPath)
      .on("end", resolve)
      .on("error", reject)
      .run();
  });
}

function parseArgs() {
  const args = process.argv.slice(2);
  const options = {
    limit: DEFAULT_MAX,
    force: false,
    dryRun: false,
  };
  args.forEach((arg) => {
    if (arg === "--force") options.force = true;
    if (arg === "--dry-run") options.dryRun = true;
    if (arg.startsWith("--limit=")) {
      const raw = Number(arg.split("=")[1]);
      if (Number.isFinite(raw)) options.limit = raw;
    }
  });
  return options;
}

async function run() {
  loadEnvFile();
  const options = parseArgs();
  console.log("Starting preview generation...");
  console.log(`Options: limit=${options.limit || "all"}, force=${options.force}, dryRun=${options.dryRun}`);
  await ensureFfmpeg();

  const config = readEnv();
  const client = createClient(config);

  const mongoUri = process.env.MONGODB_URI || process.env.MONGODB_CONNECTION_STRING;
  if (!mongoUri) {
    throw new Error("Missing MONGODB_URI or MONGODB_CONNECTION_STRING");
  }
  const databaseName = process.env.MONGODB_DATABASE_NAME || "ERP";
  const mongoClient = new MongoClient(mongoUri, {
    ssl: process.env.MONGODB_SSL === "true" || false,
    readPreference: process.env.MONGODB_READ_PREFERENCE || "primary",
  });

  await mongoClient.connect();
  const db = mongoClient.db(databaseName);
  const assetsCollection = db.collection("storageAssets");

  console.log("Listing objects from R2...");
  const keys = await listAllKeys(client, config);
  console.log(`Found ${keys.length} objects under prefix "${config.keyPrefix || "/"}".`);
  const limit = options.limit && options.limit > 0 ? options.limit : keys.length;
  const targets = keys.slice(0, limit);
  console.log(`Processing ${targets.length} objects...`);

  let processed = 0;
  let skipped = 0;

  for (const key of targets) {
    console.log(`\nProcessing: ${key}`);
    const doc = await assetsCollection.findOne({ key }, { projection: { previewBase64: 1 } });
    if (doc?.previewBase64 && !options.force) {
      console.log("Skipped (preview exists).");
      skipped += 1;
      continue;
    }

    const head = await client.send(
      new HeadObjectCommand({
        Bucket: config.bucket,
        Key: key,
      })
    );
    const contentType = head.ContentType || "";
    const isImage = contentType.startsWith("image/");
    const isVideo = contentType.startsWith("video/");
    if (!isImage && !isVideo) {
      console.log(`Skipped (unsupported contentType: ${contentType || "unknown"}).`);
      skipped += 1;
      continue;
    }

    const safeBase = `${Date.now()}-${path.basename(key).replace(/[^a-zA-Z0-9._-]/g, "")}`;
    const inputPath = path.join(tmpdir(), `preview-in-${safeBase}`);
    const outputPath = path.join(tmpdir(), `preview-out-${safeBase}.jpg`);

    try {
      console.log("Downloading object...");
      await downloadObject(client, config, key, inputPath);
      if (isImage) {
        console.log("Generating image preview...");
        await generateImagePreview(inputPath, outputPath);
      } else {
        console.log("Generating video preview...");
        await generateVideoPreview(inputPath, outputPath);
      }

      const buffer = await fsp.readFile(outputPath);
      const base64 = `data:image/jpeg;base64,${buffer.toString("base64")}`;

      if (!options.dryRun) {
        await assetsCollection.updateOne(
          { key },
          {
            $set: {
              previewBase64: base64,
              contentType: contentType || null,
              updatedAt: new Date(),
            },
            $setOnInsert: {
              key,
              name: path.basename(key),
              createdAt: new Date(),
            },
          },
          { upsert: true }
        );
      }

      processed += 1;
      if (processed % 10 === 0) {
        console.log(`Generated previews: ${processed}, skipped: ${skipped}`);
      }
    } catch (error) {
      console.error(`Failed to generate preview for ${key}`, error);
    } finally {
      await Promise.allSettled([fsp.unlink(inputPath), fsp.unlink(outputPath)]);
    }
  }

  await mongoClient.close();
  console.log(`Done. Generated: ${processed}, skipped: ${skipped}`);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
