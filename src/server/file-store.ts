import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import type { NutritionState } from "../shared/type.nutrition.js";
import {
  applyPersisted,
  blankPersisted,
  readPersisted,
  type NourishStore,
  type Persisted,
} from "./store.js";

export class FileStore implements NourishStore {
  private chain: Promise<unknown> = Promise.resolve();

  constructor(private readonly filePath: string) {}

  async sync(
    userId: string,
    email: string | null,
    _deviceId: string | null,
    incoming: unknown[],
  ) {
    return this.exclusive(async () => {
      const data = await this.load();
      const next = applyPersisted(data, userId, email, incoming);
      await this.save(next.data);
      return next.outcome;
    });
  }

  async read(userId: string, email: string | null): Promise<NutritionState> {
    return this.exclusive(async () => {
      const data = await this.load();
      if (email && !data.users.some((user) => user.userId === userId)) {
        data.users.push({ userId, email });
        await this.save(data);
      }
      return readPersisted(data, userId);
    });
  }

  private exclusive<T>(work: () => Promise<T>): Promise<T> {
    const run = this.chain.then(work, work);
    this.chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  private async load(): Promise<Persisted> {
    try {
      return JSON.parse(await readFile(this.filePath, "utf8")) as Persisted;
    } catch {
      return blankPersisted();
    }
  }

  private async save(data: Persisted): Promise<void> {
    await mkdir(path.dirname(this.filePath), { recursive: true });
    await writeFile(this.filePath, JSON.stringify(data));
  }
}
