import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname } from "node:path";

export async function ensureDir(path: string): Promise<void> {
    await mkdir(path, { recursive: true });
}

export async function readJson<T>(path: string): Promise<T | null> {
    try {
        const txt = await readFile(path, "utf8");
        return JSON.parse(txt) as T;
    } catch (e: unknown) {
        if ((e as NodeJS.ErrnoException).code === "ENOENT") return null;
        throw e;
    }
}

export async function writeJson(path: string, value: unknown): Promise<void> {
    await ensureDir(dirname(path));
    await writeFile(path, JSON.stringify(value, null, 2), "utf8");
}
