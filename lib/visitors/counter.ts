import { promises as fs } from "fs";
import path from "path";

const VISITOR_KEY = "pension-news:visitors";
const LOCAL_COUNT_FILE = path.join(process.cwd(), ".data", "visitor-count.json");

interface LocalCountFile {
  count: number;
}

function getRedisConfig() {
  const url =
    process.env.KV_REST_API_URL ?? process.env.UPSTASH_REDIS_REST_URL ?? "";
  const token =
    process.env.KV_REST_API_TOKEN ?? process.env.UPSTASH_REDIS_REST_TOKEN ?? "";

  return { url: url.replace(/\/$/, ""), token };
}

async function redisCommand<T>(parts: string[]): Promise<T | null> {
  const { url, token } = getRedisConfig();
  if (!url || !token) return null;

  const response = await fetch(`${url}/${parts.join("/")}`, {
    method: parts[0] === "get" ? "GET" : "POST",
    headers: {
      Authorization: `Bearer ${token}`,
    },
    cache: "no-store",
  });

  if (!response.ok) {
    throw new Error(`Redis command failed: ${response.status}`);
  }

  const data = (await response.json()) as { result?: T };
  return data.result ?? null;
}

async function readLocalCount(): Promise<number> {
  try {
    const raw = await fs.readFile(LOCAL_COUNT_FILE, "utf8");
    const parsed = JSON.parse(raw) as LocalCountFile;
    return typeof parsed.count === "number" ? parsed.count : 0;
  } catch {
    return 0;
  }
}

async function writeLocalCount(count: number): Promise<void> {
  await fs.mkdir(path.dirname(LOCAL_COUNT_FILE), { recursive: true });
  await fs.writeFile(
    LOCAL_COUNT_FILE,
    JSON.stringify({ count } satisfies LocalCountFile),
    "utf8",
  );
}

declare global {
  var __pensionNewsVisitorCount: number | undefined;
}

function readMemoryCount(): number {
  return globalThis.__pensionNewsVisitorCount ?? 0;
}

function writeMemoryCount(count: number): void {
  globalThis.__pensionNewsVisitorCount = count;
}

export async function getVisitorCount(): Promise<number> {
  const redisCount = await redisCommand<number>(["get", VISITOR_KEY]);
  if (typeof redisCount === "number") {
    return redisCount;
  }

  if (process.env.NODE_ENV === "development") {
    return readLocalCount();
  }

  return readMemoryCount();
}

export async function incrementVisitorCount(): Promise<number> {
  const redisCount = await redisCommand<number>(["incr", VISITOR_KEY]);
  if (typeof redisCount === "number") {
    return redisCount;
  }

  if (process.env.NODE_ENV === "development") {
    const nextCount = (await readLocalCount()) + 1;
    await writeLocalCount(nextCount);
    return nextCount;
  }

  const nextCount = readMemoryCount() + 1;
  writeMemoryCount(nextCount);
  return nextCount;
}
