#!/usr/bin/env node

/**
 * Standalone sender for Off-Time table images via WhatsApp.
 *
 * Flow:
 * 1) Read jobs from MongoDB collection `send_offtime_whatsapp`
 * 2) Calculate off-time periods directly from MongoDB (`Device_setting` + `devicedatas`)
 * 3) Render a table image locally using Puppeteer
 * 4) Send image to WAHA API
 * 5) Update job status in MongoDB (`sent` / `failed`)
 *
 * Required env:
 * - MONGODB_CNC_URI
 * - WAHA_API_KEY
 *
 * Optional env:
 * - MONGODB_CNC_DATABASE_NAME (default: CNC_GENIE)
 * - SEND_OFFTIME_COLLECTION (default: send_offtime_whatsapp)
 * - WAHA_API_URL (default: https://wapi.tranceedtechnology.com)
 * - WAHA_SESSION (default: default)
 * - MIN_DURATION (default: 20)
 * - REPORT_DATE (YY/MM/DD). If omitted, yesterday is used.
 * - ONLY_PENDING=true|false (default: true)
 * - LIMIT (default: 100)
 */

const { MongoClient } = require("mongodb");
const puppeteer = require("puppeteer");

const MONGODB_CNC_URI = process.env.MONGODB_CNC_URI;
const MONGODB_CNC_DATABASE_NAME =
  process.env.MONGODB_CNC_DATABASE_NAME || "CNC_GENIE";
const SEND_OFFTIME_COLLECTION =
  process.env.SEND_OFFTIME_COLLECTION || "send_offtime_whatsapp";

const WAHA_API_URL =
  process.env.WAHA_API_URL || "https://wapi.tranceedtechnology.com";
const WAHA_API_KEY = process.env.WAHA_API_KEY;
const WAHA_SESSION = process.env.WAHA_SESSION || "default";
const MIN_DURATION = Number.parseInt(process.env.MIN_DURATION || "20", 10);
const ONLY_PENDING = (process.env.ONLY_PENDING || "true") === "true";
const LIMIT = Number.parseInt(process.env.LIMIT || "100", 10);

function getYesterdayYYMMDD() {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  const yy = String(d.getFullYear() % 100);
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yy}/${mm}/${dd}`;
}

function requiredEnvOrThrow() {
  const missing = [];
  if (!MONGODB_CNC_URI) missing.push("MONGODB_CNC_URI");
  if (!WAHA_API_KEY) missing.push("WAHA_API_KEY");
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

function esc(v) {
  return String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}

function parseDateTime(dateStr, timeStr) {
  const [yearStr, monthStr, dayStr] = String(dateStr || "").split("/");
  const yearNum = Number.parseInt(yearStr, 10);
  const monthNum = Number.parseInt(monthStr, 10);
  const dayNum = Number.parseInt(dayStr, 10);
  const fullYear = yearNum < 100 ? 2000 + yearNum : yearNum;

  const timeParts = String(timeStr || "00:00:00").split(":");
  const h = Number.parseInt(timeParts[0] || "0", 10);
  const m = Number.parseInt(timeParts[1] || "0", 10);
  const s = Number.parseInt(timeParts[2] || "0", 10);

  return new Date(fullYear, (monthNum || 1) - 1, dayNum || 1, h || 0, m || 0, s || 0);
}

function formatTimeHHMMSS(date) {
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  const seconds = String(date.getSeconds()).padStart(2, "0");
  return `${hours}:${minutes}:${seconds}`;
}

function formatDuration(totalSeconds) {
  if (totalSeconds <= 0) return "00:00:00";
  const hours = Math.floor(totalSeconds / 3600);
  const minutes = Math.floor((totalSeconds % 3600) / 60);
  const seconds = totalSeconds % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

function durationToMinutes(dur) {
  if (!dur || dur === "-") return 0;
  const parts = String(dur)
    .split(":")
    .map((n) => Number.parseInt(n, 10));
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 60 + m + s / 60;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m + s / 60;
  }
  return 0;
}

function dateToTimestamp(dateStr) {
  if (!dateStr || dateStr === "-") return 0;
  const parts = String(dateStr).split("/");
  if (parts.length !== 3) return 0;
  const [year, month, day] = parts.map((n) => Number.parseInt(n, 10));
  if ([year, month, day].some(Number.isNaN)) return 0;
  const fullYear = year < 100 ? 2000 + year : year;
  return new Date(fullYear, month - 1, day).getTime();
}

function timeToSeconds(timeStr) {
  if (!timeStr || timeStr === "-") return 0;
  const parts = String(timeStr)
    .split(":")
    .map((n) => Number.parseInt(n, 10));
  if (parts.some(Number.isNaN)) return 0;
  if (parts.length === 3) {
    const [h, m, s] = parts;
    return h * 3600 + m * 60 + s;
  }
  if (parts.length === 2) {
    const [m, s] = parts;
    return m * 60 + s;
  }
  return 0;
}

function calculateTotalDuration(periods) {
  let totalSeconds = 0;
  for (const period of periods) {
    const parts = String(period.timediff || "00:00:00")
      .split(":")
      .map((n) => Number.parseInt(n, 10));
    if (parts.length === 3 && !parts.some(Number.isNaN)) {
      const [h, m, s] = parts;
      totalSeconds += h * 3600 + m * 60 + s;
    }
  }
  return formatDuration(totalSeconds);
}

function getStatusFromValue(value, onThreshold, lowThreshold) {
  if (onThreshold !== null && value >= onThreshold) return "ON";
  if (lowThreshold !== null && value >= lowThreshold) return "LOW";
  return "OFF";
}

function analyzeGraphData(graphData, channel, currentDate, onThreshold, lowThreshold) {
  if (!graphData.length) return [];

  const sortedData = [...graphData].sort((a, b) => {
    const da = parseDateTime(a.date || currentDate, a.time || "00:00:00");
    const db = parseDateTime(b.date || currentDate, b.time || "00:00:00");
    return da.getTime() - db.getTime();
  });

  const periods = [];
  let previousStatus = null;
  let currentPeriodStart = null;
  let currentPeriodStartDate = currentDate;
  let currentPeriodStartTime = "00:00:00";

  for (let i = 0; i < sortedData.length; i += 1) {
    const record = sortedData[i];
    const recordValue =
      typeof record[channel] === "number"
        ? record[channel]
        : Number(record[channel]) || 0;
    const recordDate = record.date || currentDate;
    const recordTime = record.time || "00:00:00";
    const recordDateTime = parseDateTime(recordDate, recordTime);
    const currentStatus = getStatusFromValue(recordValue, onThreshold, lowThreshold);

    if (i === 0) {
      previousStatus = currentStatus;
      currentPeriodStart = recordDateTime;
      currentPeriodStartDate = recordDate;
      currentPeriodStartTime = recordTime;
      continue;
    }

    const prev = sortedData[i - 1];
    const prevDate = prev.date || currentDate;
    const prevTime = prev.time || "00:00:00";
    const prevDateTime = parseDateTime(prevDate, prevTime);
    const gapMinutes = (recordDateTime.getTime() - prevDateTime.getTime()) / (1000 * 60);
    const GAP_THRESHOLD_MINUTES = 3;

    if (gapMinutes > GAP_THRESHOLD_MINUTES) {
      if (previousStatus !== null && currentPeriodStart !== null) {
        const periodEnd = prevDateTime;
        const periodSeconds = Math.floor((periodEnd.getTime() - currentPeriodStart.getTime()) / 1000);
        if (periodSeconds > 0) {
          periods.push({
            date: currentPeriodStartDate,
            time: currentPeriodStartTime,
            status: previousStatus,
            endtime: formatTimeHHMMSS(periodEnd),
            timediff: formatDuration(periodSeconds),
          });
        }
      }

      const outSeconds = Math.floor((recordDateTime.getTime() - prevDateTime.getTime()) / 1000);
      if (outSeconds > 0) {
        periods.push({
          date: prevDate,
          time: prevTime,
          status: "OUT",
          endtime: formatTimeHHMMSS(recordDateTime),
          timediff: formatDuration(outSeconds),
        });
      }

      currentPeriodStart = recordDateTime;
      currentPeriodStartDate = recordDate;
      currentPeriodStartTime = recordTime;
      previousStatus = currentStatus;
      continue;
    }

    if (currentStatus !== previousStatus && previousStatus !== null && currentPeriodStart !== null) {
      const periodEnd = recordDateTime;
      const periodSeconds = Math.floor((periodEnd.getTime() - currentPeriodStart.getTime()) / 1000);
      if (periodSeconds > 0) {
        periods.push({
          date: currentPeriodStartDate,
          time: currentPeriodStartTime,
          status: previousStatus,
          endtime: formatTimeHHMMSS(periodEnd),
          timediff: formatDuration(periodSeconds),
        });
      }

      currentPeriodStart = recordDateTime;
      currentPeriodStartDate = recordDate;
      currentPeriodStartTime = recordTime;
    }

    previousStatus = currentStatus;
  }

  if (currentPeriodStart !== null && previousStatus !== null && sortedData.length > 0) {
    const last = sortedData[sortedData.length - 1];
    const lastDate = last.date || currentDate;
    const lastTime = last.time || "00:00:00";
    const lastDateTime = parseDateTime(lastDate, lastTime);
    const periodSeconds = Math.floor((lastDateTime.getTime() - currentPeriodStart.getTime()) / 1000);
    if (periodSeconds > 0) {
      periods.push({
        date: currentPeriodStartDate,
        time: currentPeriodStartTime,
        status: previousStatus,
        endtime: formatTimeHHMMSS(lastDateTime),
        timediff: formatDuration(periodSeconds),
      });
    }
  }

  return periods;
}

async function buildReportFromDb(db, { deviceNo, date, statusFilters, minDuration }) {
  const devNo = Number.parseInt(String(deviceNo), 10);
  if (Number.isNaN(devNo)) {
    throw new Error(`Invalid deviceNo: ${deviceNo}`);
  }

  const deviceSettings = await db.collection("Device_setting").findOne({ deviceno: devNo });
  if (!deviceSettings) {
    throw new Error(`Device settings not found for device ${devNo}`);
  }

  const channels = ["ch1", "ch2", "ch3", "ch4", "ch5", "ch6", "ch7", "ch8"];
  const shifts = ["morning", "evening", "night"];
  const allowedStatuses = new Set(
    String(statusFilters || "OFF,LOW,OUT")
      .split(",")
      .map((s) => s.trim().toUpperCase())
      .filter(Boolean)
  );

  const results = [];

  for (const ch of channels) {
    if (!deviceSettings[ch]) continue;

    const channelSettings = deviceSettings[ch];
    const onThreshold = channelSettings.ON_Threshold ?? null;
    const lowThreshold = channelSettings.LOW_Effeciency_Threshold ?? null;
    const machineName = channelSettings.Name || `Machine ${ch.toUpperCase()}`;

    for (const sh of shifts) {
      const shiftKey = `${ch}_shift`;
      const shiftValue = `${date} ${sh}`;

      const graphData = await db
        .collection("devicedatas")
        .find(
          { deviceno: devNo, [shiftKey]: shiftValue },
          { projection: { _id: 0, time: 1, date: 1, [ch]: 1 } }
        )
        .toArray();

      if (graphData.length === 0) continue;

      const periods = analyzeGraphData(graphData, ch, date, onThreshold, lowThreshold);
      const filteredPeriods = periods
        .filter((period) => {
          const mins = durationToMinutes(period.timediff);
          const status = String(period.status || "").toUpperCase();
          return mins >= minDuration && mins <= 24 * 60 && allowedStatuses.has(status);
        })
        .sort((a, b) => {
          const d = dateToTimestamp(a.date) - dateToTimestamp(b.date);
          if (d !== 0) return d;
          return timeToSeconds(a.time) - timeToSeconds(b.time);
        });

      results.push({
        channel: ch,
        shift: sh,
        machineName,
        periods: filteredPeriods,
        count: filteredPeriods.length,
        totalPeriods: periods.length,
        totalDuration: calculateTotalDuration(filteredPeriods),
      });
    }
  }

  return {
    deviceNo: devNo,
    date,
    minDuration,
    statusFilters: Array.from(allowedStatuses),
    results,
    totalChannels: results.length,
  };
}

function buildHtml(report) {
  const rows = (report.results || [])
    .map((group) => {
      const header = `
        <div class="section-header">
          ${esc(group.machineName || group.channel || "-")} | ${esc(
        (group.channel || "").toUpperCase()
      )} | ${esc(group.shift || "-")}
        </div>
      `;

      const bodyRows =
        group.periods && group.periods.length
          ? group.periods
              .map(
                (p) => `
            <tr>
              <td>${esc(p.date || "-")}</td>
              <td>${esc(p.time || "-")}</td>
              <td>${esc(p.status || "-")}</td>
              <td>${esc(p.endtime || "-")}</td>
              <td>${esc(p.timediff || "-")}</td>
            </tr>
          `
              )
              .join("")
          : `<tr><td colspan="5" class="empty">No periods found</td></tr>`;

      return `
        <div class="section">
          ${header}
          <table>
            <thead>
              <tr>
                <th>Date</th>
                <th>Start</th>
                <th>Status</th>
                <th>End</th>
                <th>Duration</th>
              </tr>
            </thead>
            <tbody>${bodyRows}</tbody>
          </table>
          <div class="summary">Count: ${esc(group.count || 0)} | Total: ${esc(
        group.totalDuration || "00:00:00"
      )}</div>
        </div>
      `;
    })
    .join("");

  return `
    <!doctype html>
    <html>
      <head>
        <meta charset="utf-8" />
        <style>
          * { box-sizing: border-box; margin: 0; padding: 0; }
          body { font-family: Arial, sans-serif; color: #111; background: #fff; padding: 16px; width: 1500px; }
          h1 { font-size: 22px; margin-bottom: 8px; }
          .meta { margin-bottom: 16px; font-size: 13px; color: #444; line-height: 1.5; }
          .section { margin-bottom: 22px; border: 1px solid #ddd; border-radius: 6px; overflow: hidden; }
          .section-header { background: #1f2937; color: #fff; padding: 8px 12px; font-size: 13px; font-weight: 700; }
          table { width: 100%; border-collapse: collapse; font-size: 12px; }
          th, td { border: 1px solid #e5e7eb; padding: 6px 8px; text-align: left; }
          th { background: #f3f4f6; }
          .summary { padding: 8px 12px; background: #eef2ff; font-size: 12px; font-weight: 600; }
          .empty { text-align: center; color: #6b7280; padding: 14px; }
          .footer { margin-top: 12px; font-size: 11px; color: #666; }
        </style>
      </head>
      <body>
        <h1>Off-Time Analysis Report</h1>
        <div class="meta">
          Device: ${esc(report.deviceNo)}<br/>
          Date: ${esc(report.date)}<br/>
          Generated: ${esc(new Date().toISOString())}
        </div>
        ${rows || `<div class="empty">No channel/shift results available</div>`}
        <div class="footer">Generated by send_off_time_table.js</div>
      </body>
    </html>
  `;
}

let browser = null;
async function getBrowser() {
  if (browser) return browser;
  browser = await puppeteer.launch({
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-gpu",
    ],
    timeout: 60000,
  });
  return browser;
}

async function renderImageBuffer(report) {
  const html = buildHtml(report);
  const b = await getBrowser();
  const page = await b.newPage();
  try {
    await page.setViewport({ width: 1600, height: 900, deviceScaleFactor: 2 });
    await page.setContent(html, {
      waitUntil: "domcontentloaded",
      timeout: 60000,
    });
    await new Promise((r) => setTimeout(r, 300));
    const body = await page.$("body");
    if (!body) throw new Error("Failed to render report body");
    return await body.screenshot({ type: "png", timeout: 30000 });
  } finally {
    await page.close().catch(() => {});
  }
}

async function sendToWhatsapp({ phone, caption, buffer, deviceNo, date }) {
  const payload = {
    chatId: phone,
    file: {
      mimetype: "image/png",
      filename: `offtime-${deviceNo}-${date.replaceAll("/", "-")}.png`,
      url: `data:image/png;base64,${buffer.toString("base64")}`,
    },
    reply_to: null,
    caption: caption || `Off-Time Report - Device ${deviceNo} - ${date}`,
    session: WAHA_SESSION,
  };

  const wahaRes = await fetch(`${WAHA_API_URL}/api/sendImage`, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "X-Api-Key": WAHA_API_KEY,
    },
    body: JSON.stringify(payload),
  });

  if (!wahaRes.ok) {
    const txt = await wahaRes.text();
    throw new Error(`WAHA sendImage failed (${wahaRes.status}): ${txt.slice(0, 500)}`);
  }

  return wahaRes.json().catch(() => ({ success: true }));
}

async function processJobs() {
  requiredEnvOrThrow();

  const reportDate = process.env.REPORT_DATE || getYesterdayYYMMDD();
  const client = new MongoClient(MONGODB_CNC_URI, {
    maxPoolSize: 5,
    serverSelectionTimeoutMS: 30000,
  });

  await client.connect();
  const db = client.db(MONGODB_CNC_DATABASE_NAME);
  const collection = db.collection(SEND_OFFTIME_COLLECTION);

  const filter = ONLY_PENDING ? { status: "pending" } : {};
  const jobs = await collection
    .find(filter)
    .sort({ updatedAt: 1, createdAt: 1 })
    .limit(LIMIT)
    .toArray();

  if (!jobs.length) {
    console.log("No jobs found.");
    await client.close();
    return;
  }

  console.log(`Found ${jobs.length} job(s). Report date: ${reportDate}`);

  let sent = 0;
  let failed = 0;

  for (const job of jobs) {
    const now = new Date();
    try {
      if (!job.deviceNo || !job.phone) {
        throw new Error("Missing deviceNo or phone in job");
      }

      console.log(
        `Processing _id=${job._id} deviceNo=${job.deviceNo} phone=${job.phone}`
      );

      const report = await buildReportFromDb(db, {
        deviceNo: job.deviceNo,
        date: reportDate,
        statusFilters: job.statusFilters || "OFF,LOW,OUT",
        minDuration: MIN_DURATION,
      });

      const imageBuffer = await renderImageBuffer(report);

      const wahaResponse = await sendToWhatsapp({
        phone: job.phone,
        caption: job.caption,
        buffer: imageBuffer,
        deviceNo: job.deviceNo,
        date: reportDate,
      });

      await collection.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "sent",
            sentAt: now,
            updatedAt: now,
            lastError: null,
            lastRunDate: reportDate,
            wahaResponse,
          },
        }
      );

      sent += 1;
      console.log(`Sent successfully for _id=${job._id}`);
    } catch (err) {
      failed += 1;
      const message = err && err.message ? err.message : String(err);
      console.error(`Failed for _id=${job._id}: ${message}`);
      await collection.updateOne(
        { _id: job._id },
        {
          $set: {
            status: "failed",
            updatedAt: now,
            lastError: message,
            lastRunDate: reportDate,
          },
        }
      );
    }
  }

  if (browser) {
    await browser.close().catch(() => {});
    browser = null;
  }
  await client.close();

  console.log(`Done. sent=${sent}, failed=${failed}`);
}

processJobs().catch(async (err) => {
  console.error(`Fatal error: ${err.message || err}`);
  if (browser) {
    await browser.close().catch(() => {});
  }
  process.exit(1);
});
