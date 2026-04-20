import fs from 'node:fs/promises';
import path from 'node:path';

export function createDiskCache({ cacheDir, ttlMs }) {
  const filePath = path.join(cacheDir, 'feed-cache.json');

  async function ensureDir() {
    await fs.mkdir(cacheDir, { recursive: true });
  }

  async function read() {
    try {
      const raw = await fs.readFile(filePath, 'utf8');
      return JSON.parse(raw);
    } catch {
      return null;
    }
  }

  async function write(payload) {
    await ensureDir();
    const tmp = `${filePath}.tmp`;
    await fs.writeFile(tmp, JSON.stringify(payload), 'utf8');
    await fs.rename(tmp, filePath);
  }

  return {
    async get(validIfYoungerThanMs = ttlMs) {
      const data = await read();
      if (!data || typeof data.fetchedAt !== 'number') return null;
      if (Date.now() - data.fetchedAt > validIfYoungerThanMs) return null;
      return data;
    },
    async set(body) {
      await write({ ...body, fetchedAt: Date.now() });
    },
    async clear() {
      try {
        await fs.unlink(filePath);
      } catch {
        /* noop */
      }
    },
  };
}
