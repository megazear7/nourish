import { LitElement, html, type TemplateResult } from "lit";
import { customElement, state } from "lit/decorators.js";
import { live } from "lit/directives/live.js";
import {
  CalorieEntry,
  Meal,
  NutritionState,
} from "../shared/type.nutrition.js";
import {
  addDays,
  backfillTimestamp,
  dateKey,
  formatDayLabel,
  formatTime,
  parseDateKey,
  timeValue,
  todayKey,
  withTime,
} from "../shared/util.dates.js";
import {
  toneColor,
  toneLabel,
  weightedOver,
  UNTRACKED_FALLBACK,
  dayTotal,
  yellowCalories,
} from "../shared/util.score.js";
import { goalForDay, isFasted } from "../shared/fold.js";
import { loadState, saveState } from "./util.storage.js";
import {
  enqueue,
  loadQueue,
  markSyncedUser,
  resetOpenDocument,
  restoreAccount,
  stashAccount,
  type OpDraft,
} from "./util.queue.js";
import { pushActivity, recordLogin, recordOps } from "./util.activity.js";
import { UserDataClient } from "./identity-client.js";
import {
  accessToken,
  authConfig,
  authConfigured,
  idToken,
  initAuth,
  login,
  logout,
  signedOut,
  type Account,
} from "./util.auth.js";
import { backfillCreates, flushSync, signInAgainNote } from "./util.sync.js";
import { appStyles } from "./styles.global.js";

type PageName =
  "today" | "history" | "meals" | "goal" | "meal" | "new-meal" | "day";

const QUICK_WINDOW_MS = 60_000;
const WEEKDAYS = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"];

function monthKey(key: string): string {
  return key.slice(0, 7);
}

function shiftMonth(month: string, delta: number): string {
  const [year, monthNumber] = month.split("-").map(Number);
  const date = new Date(year ?? 1970, (monthNumber ?? 1) - 1 + delta, 1);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  return new Date(year ?? 1970, (monthNumber ?? 1) - 1, 1).toLocaleDateString(
    undefined,
    {
      month: "long",
      year: "numeric",
    },
  );
}

function monthCells(month: string): { key: string; inMonth: boolean }[] {
  const [year, monthNumber] = month.split("-").map(Number);
  const first = new Date(year ?? 1970, (monthNumber ?? 1) - 1, 1);
  const start = new Date(first);
  start.setDate(1 - first.getDay());
  const cells: { key: string; inMonth: boolean }[] = [];
  for (let index = 0; index < 42; index += 1) {
    const date = new Date(start);
    date.setDate(start.getDate() + index);
    cells.push({
      key: dateKey(date),
      inMonth: date.getMonth() === first.getMonth(),
    });
  }
  while (cells.length > 35 && cells.slice(-7).every((cell) => !cell.inMonth))
    cells.splice(-7, 7);
  return cells;
}

function titleCase(value: string): string {
  return value
    .toLowerCase()
    .replace(
      /(^|[^\p{L}])(\p{L})/gu,
      (_match, lead: string, letter: string) => lead + letter.toUpperCase(),
    );
}

type ShownEntry = {
  key: string;
  entries: CalorieEntry[];
  calories: number;
  timestamp: string;
  mealId?: string;
};

function shownEntries(entries: CalorieEntry[]): ShownEntry[] {
  const ordered = [...entries].sort((a, b) =>
    a.timestamp.localeCompare(b.timestamp),
  );
  const shown: ShownEntry[] = [];
  let quick: CalorieEntry[] = [];
  let quickStart = 0;

  const flushQuick = (): void => {
    if (!quick.length) return;
    const grouped = quick;
    const latest = grouped[grouped.length - 1];
    if (!latest) return;
    shown.push({
      key: grouped.map((entry) => entry.id).join(":"),
      entries: grouped,
      calories: grouped.reduce((sum, entry) => sum + entry.calories, 0),
      timestamp: latest.timestamp,
    });
    quick = [];
  };

  for (const entry of ordered) {
    if (entry.mealId) {
      shown.push({
        key: entry.id,
        entries: [entry],
        calories: entry.calories,
        timestamp: entry.timestamp,
        mealId: entry.mealId,
      });
      continue;
    }
    const time = new Date(entry.timestamp).getTime();
    if (!quick.length || time - quickStart > QUICK_WINDOW_MS) {
      flushQuick();
      quick = [entry];
      quickStart = time;
      continue;
    }
    quick.push(entry);
  }
  flushQuick();
  return shown.sort((a, b) => b.timestamp.localeCompare(a.timestamp));
}

@customElement("nourish-app")
export class NourishApp extends LitElement {
  static override styles = appStyles;

  @state() private state: NutritionState = loadState();
  @state() private page: PageName = "today";
  @state() private selectedMealId = "";
  @state() private selectedDayKey = "";
  @state() private menuOpen = false;
  @state() private menuMounted = false;
  private menuTimer = 0;
  private menuTicket = 0;
  @state() private mealPickerOpen = false;
  @state() private kebabKey = "";
  @state() private mealDragging = "";
  @state() private mealDropIndex = -1;
  private mealPointer: {
    id: string;
    pointerId: number;
    x: number;
    y: number;
  } | null = null;
  @state() private offline = !navigator.onLine;
  @state() private account: Account = { ...signedOut(), status: "checking" };
  @state() private syncNote = "";
  @state() private shareCopied = false;
  private shareTimer = 0;
  @state() private historyMode: "list" | "calendar" = "calendar";
  @state() private calendarMonth = monthKey(todayKey());
  @state() private editKey = "";
  @state() private editMeal = false;
  @state() private editCalories = "";
  @state() private editTitle = "";
  @state() private editDescription = "";
  @state() private dayGoalKey = "";
  @state() private dayGoalCalories = "";
  @state() private fastKey = "";
  private editIds: string[] = [];
  private lastAddClickAt = 0;
  private lastAddStamp = "";
  private lastAddDay = "";

  override connectedCallback(): void {
    super.connectedCallback();
    this.syncRoute();
    window.addEventListener("popstate", this.syncRoute);
    window.addEventListener("online", this.onOnline);
    window.addEventListener("offline", this.onOffline);
    this.registerWorker();
    document.addEventListener("visibilitychange", this.onVisibility);
    void this.startSession();
  }

  override disconnectedCallback(): void {
    window.clearTimeout(this.menuTimer);
    window.clearTimeout(this.shareTimer);
    this.endMealPointer();
    window.removeEventListener("popstate", this.syncRoute);
    window.removeEventListener("online", this.onOnline);
    window.removeEventListener("offline", this.onOffline);
    document.removeEventListener("visibilitychange", this.onVisibility);
    super.disconnectedCallback();
  }

  private onOnline = (): void => {
    this.offline = false;
    void this.flush();
  };

  private onOffline = (): void => {
    this.offline = true;
  };

  private onVisibility = (): void => {
    if (document.visibilityState !== "visible") return;
    void this.flush();
    if (!("serviceWorker" in navigator)) return;
    void navigator.serviceWorker
      .getRegistration()
      .then((registration) => registration?.update());
  };

  private registerWorker(): void {
    if (!("serviceWorker" in navigator)) return;
    void navigator.storage?.persist?.().catch(() => undefined);
    if (navigator.serviceWorker.controller) {
      navigator.serviceWorker.addEventListener("controllerchange", () => {
        try {
          if (sessionStorage.getItem("nourish-reloading") === "1") return;
          sessionStorage.setItem("nourish-reloading", "1");
        } catch {
          return;
        }
        window.location.reload();
      });
    }
    try {
      sessionStorage.removeItem("nourish-reloading");
    } catch {
      /* Storage can be blocked. Registration still has to run. */
    }
    void navigator.serviceWorker
      .register("/sw.js")
      .then((registration) => registration.update())
      .catch(() => undefined);
  }

  private syncRoute = (): void => {
    this.closeEdit();
    const path = window.location.pathname;
    const meal = path.match(/^\/meal\/([^/]+)\/?$/);
    if (meal) {
      this.page = "meal";
      this.selectedMealId = decodeURIComponent(meal[1] ?? "");
    } else if (path.startsWith("/day/")) {
      const key = decodeURIComponent(path.slice(5)).replace(/\/$/, "");
      if (
        /^\d{4}-\d{2}-\d{2}$/.test(key) &&
        dateKey(parseDateKey(key)) === key
      ) {
        this.page = "day";
        this.selectedDayKey = key;
      } else this.page = "history";
    } else if (path.startsWith("/history")) this.page = "history";
    else if (path === "/meals/new" || path.startsWith("/meals/new/"))
      this.page = "new-meal";
    else if (path.startsWith("/meals")) this.page = "meals";
    else if (path.startsWith("/goal")) this.page = "goal";
    else this.page = "today";
  };

  private navigate(page: PageName): void {
    const path = page === "today" ? "/" : `/${page}`;
    window.history.pushState({}, "", path);
    this.page = page;
    this.closeMenu();
    this.mealPickerOpen = false;
    this.kebabKey = "";
    this.closeEdit();
  }

  private openMeal(id: string): void {
    window.history.pushState({}, "", `/meal/${encodeURIComponent(id)}`);
    this.page = "meal";
    this.selectedMealId = id;
    this.closeMenu();
    this.mealPickerOpen = false;
    this.kebabKey = "";
    this.closeEdit();
  }

  private openNewMeal(): void {
    window.history.pushState({}, "", "/meals/new");
    this.page = "new-meal";
    this.closeMenu();
    this.mealPickerOpen = false;
    this.kebabKey = "";
    this.closeEdit();
  }

  private openDay(key: string): void {
    window.history.pushState({}, "", `/day/${key}`);
    this.page = "day";
    this.selectedDayKey = key;
    this.closeMenu();
    this.mealPickerOpen = false;
    this.kebabKey = "";
    this.closeEdit();
  }

  private commit(next: NutritionState, drafts: OpDraft[] = []): void {
    this.state = next;
    saveState(next);
    if (!drafts.length) return;
    recordOps(enqueue(drafts), next);
    void this.flush();
  }

  private caloriesFor(day: string): number | undefined {
    return goalForDay(this.state.goals, day)?.calories;
  }

  private async startSession(): Promise<void> {
    try {
      const account = await initAuth(() => recordLogin());
      this.account = account;
      if (account.status === "signed-in") this.bindAccount(account.sub);
      await this.flush();
    } catch {
      this.account = authConfigured()
        ? signedOut()
        : { ...signedOut(), status: "unconfigured" };
    }
  }

  private bindAccount(sub: string): void {
    const queue = loadQueue();
    if (queue.syncedUserId && queue.syncedUserId !== sub) {
      stashAccount(queue.syncedUserId, JSON.stringify(this.state));
      if (!restoreAccount(sub)) resetOpenDocument(queue.deviceId);
      this.state = loadState();
      markSyncedUser(sub);
      return;
    }
    if (!queue.syncedUserId) backfillCreates(this.state);
    markSyncedUser(sub);
  }

  private async flush(): Promise<void> {
    if (this.account.status !== "signed-in") return;
    const token = await accessToken();
    if (!token) {
      this.syncNote = signInAgainNote;
      return;
    }
    try {
      await flushSync(
        token,
        (next) => {
          this.state = next;
        },
        (note) => {
          this.syncNote = note;
        },
      );
    } catch (error) {
      this.syncNote = error instanceof Error ? error.message : "Sync failed.";
      return;
    }
    try {
      const client = new UserDataClient(
        authConfig().identityUrl,
        async () => (await accessToken()) ?? "",
        idToken,
      );
      await pushActivity(client, loadQueue().deviceId);
    } catch {
      if (!this.syncNote) {
        this.syncNote = "Food log synced. Activity totals could not be saved.";
      }
    }
  }

  private openMenu(): void {
    this.kebabKey = "";
    this.closeEdit();
    window.clearTimeout(this.menuTimer);
    this.menuTimer = 0;
    if (this.menuMounted) {
      this.menuOpen = true;
      return;
    }
    const ticket = ++this.menuTicket;
    this.menuMounted = true;
    this.menuOpen = false;
    void this.updateComplete.then(() => {
      requestAnimationFrame(() => {
        requestAnimationFrame(() => {
          if (ticket !== this.menuTicket || !this.menuMounted) return;
          this.menuOpen = true;
        });
      });
    });
  }

  private closeMenu(): void {
    if (!this.menuMounted) return;
    if (!this.menuOpen) {
      if (this.menuTimer) return;
      this.menuTicket += 1;
      this.menuMounted = false;
      return;
    }
    this.menuTicket += 1;
    this.menuOpen = false;
    window.clearTimeout(this.menuTimer);
    const reduce = window.matchMedia(
      "(prefers-reduced-motion: reduce)",
    ).matches;
    this.menuTimer = window.setTimeout(
      () => {
        this.menuTimer = 0;
        if (!this.menuOpen) this.menuMounted = false;
      },
      reduce ? 0 : 320,
    );
  }

  private appUrl(): string {
    return new URL("/", window.location.origin).href;
  }

  private useShareSheet(): boolean {
    if (typeof navigator.share !== "function") return false;
    return (
      window.matchMedia("(pointer: coarse)").matches &&
      window.matchMedia("(hover: none)").matches
    );
  }

  private async shareApp(): Promise<void> {
    const url = this.appUrl();
    if (this.useShareSheet()) {
      try {
        await navigator.share({ title: "Nourish", url });
        this.closeMenu();
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }
      }
    }
    await this.copyAppUrl(url);
  }

  private async copyAppUrl(url: string): Promise<void> {
    try {
      await navigator.clipboard.writeText(url);
    } catch {
      const input = document.createElement("textarea");
      input.value = url;
      input.setAttribute("readonly", "");
      input.style.position = "fixed";
      input.style.left = "-9999px";
      document.body.appendChild(input);
      input.select();
      document.execCommand("copy");
      input.remove();
    }
    this.shareCopied = true;
    window.clearTimeout(this.shareTimer);
    this.shareTimer = window.setTimeout(() => {
      this.shareCopied = false;
    }, 1600);
  }

  private async signIn(signup: boolean): Promise<void> {
    if (!authConfigured()) {
      this.syncNote = "Sign-in is not configured for this build yet.";
      return;
    }
    await login(signup);
  }

  private needsReauth(): boolean {
    return this.syncNote === signInAgainNote;
  }

  private async reauthenticate(): Promise<void> {
    this.closeMenu();
    await this.signIn(false);
  }

  private async signOut(): Promise<void> {
    this.closeMenu();
    await logout();
    this.account = signedOut();
  }

  private initials(): string {
    const source = this.account.name || this.account.email || "?";
    const parts = source.split(/\s+|@/).filter(Boolean);
    const first = parts[0]?.[0] ?? "?";
    const second = parts[1]?.[0] ?? "";
    return (first + second).toUpperCase();
  }

  private entryTimestamp(): string {
    const today = todayKey();
    if (this.page !== "day" || this.selectedDayKey === today) {
      return new Date().toISOString();
    }
    const now = Date.now();
    const repeat =
      this.lastAddDay === this.selectedDayKey &&
      this.lastAddStamp !== "" &&
      now - this.lastAddClickAt <= QUICK_WINDOW_MS;
    this.lastAddClickAt = now;
    this.lastAddDay = this.selectedDayKey;
    if (repeat) return this.lastAddStamp;
    const stamp = backfillTimestamp(
      this.selectedDayKey,
      this.dayEntries(this.selectedDayKey).map((entry) => entry.timestamp),
    );
    this.lastAddStamp = stamp;
    return stamp;
  }

  private addCalories(calories: number, mealId?: string): void {
    const meal = mealId
      ? this.state.meals.find((item) => item.id === mealId)
      : undefined;
    const entry: CalorieEntry = {
      id: crypto.randomUUID(),
      calories,
      timestamp: this.entryTimestamp(),
      mealId,
      mealTitle: meal?.title,
      mealDescription: meal?.description,
    };
    this.commit({ ...this.state, entries: [entry, ...this.state.entries] }, [
      {
        type: "entry.create",
        entityId: entry.id,
        occurredAt: entry.timestamp,
        body: {
          calories: entry.calories,
          eatenAt: entry.timestamp,
          mealId: entry.mealId,
          mealTitle: entry.mealTitle,
          mealDescription: entry.mealDescription,
        },
      },
    ]);
    this.mealPickerOpen = false;
  }

  private updateShownTime(shown: ShownEntry, time: string): void {
    const ids = new Set(shown.entries.map((entry) => entry.id));
    this.commit(
      {
        ...this.state,
        entries: this.state.entries.map((item) =>
          ids.has(item.id)
            ? { ...item, timestamp: withTime(item.timestamp, time) }
            : item,
        ),
      },
      shown.entries.map((entry) => ({
        type: "entry.patch" as const,
        entityId: entry.id,
        body: { eatenAt: withTime(entry.timestamp, time) },
      })),
    );
  }

  private removeShown(shown: ShownEntry): void {
    const ids = new Set(shown.entries.map((entry) => entry.id));
    this.commit(
      {
        ...this.state,
        entries: this.state.entries.map((entry) =>
          ids.has(entry.id) ? { ...entry, removed: true } : entry,
        ),
      },
      shown.entries.map((entry) => ({
        type: "entry.remove" as const,
        entityId: entry.id,
      })),
    );
    this.kebabKey = "";
  }

  private removeMeal(id: string): void {
    this.commit(
      {
        ...this.state,
        meals: this.state.meals.map((meal) =>
          meal.id === id ? { ...meal, removed: true } : meal,
        ),
      },
      [{ type: "meal.remove", entityId: id }],
    );
    this.kebabKey = "";
  }

  private toggleKebab(key: string): void {
    this.mealPickerOpen = false;
    this.closeMenu();
    this.kebabKey = this.kebabKey === key ? "" : key;
  }

  private openClock(shown: ShownEntry, event: Event): void {
    const trigger = event.currentTarget as HTMLElement | null;
    const input = trigger
      ?.closest(".entry-card")
      ?.querySelector<HTMLInputElement>("input.clock-input");
    if (!input) return;
    input.value = timeValue(shown.timestamp);
    this.kebabKey = "";
    try {
      input.showPicker();
    } catch {
      /* The clock is already open, or this browser will not show one. */
    }
  }

  private closeEdit(): void {
    this.editKey = "";
    this.editIds = [];
    this.dayGoalKey = "";
    this.fastKey = "";
  }

  private beginEdit(shown: ShownEntry): void {
    const entry = shown.entries[shown.entries.length - 1];
    const meal = shown.mealId
      ? this.state.meals.find((item) => item.id === shown.mealId)
      : undefined;
    this.kebabKey = "";
    this.closeMenu();
    this.mealPickerOpen = false;
    this.editIds = shown.entries.map((item) => item.id);
    this.editMeal = Boolean(shown.mealId);
    this.editCalories = String(shown.calories);
    this.editTitle = titleCase(
      shown.entries.find((item) => item.mealTitle)?.mealTitle ??
        meal?.title ??
        "",
    );
    this.editDescription = entry?.mealDescription ?? meal?.description ?? "";
    this.editKey = shown.key;
    this.renderRoot.querySelector<HTMLElement>(":focus")?.blur();
  }

  private nudgeCalories(delta: number): void {
    const current = Number(this.editCalories);
    const base = Number.isFinite(current) ? current : 0;
    this.editCalories = String(Math.max(1, Math.round(base + delta)));
  }

  private saveEdit(event: Event): void {
    event.preventDefault();
    const calories = Number(this.editCalories);
    if (!Number.isInteger(calories) || calories <= 0) return;
    const keepId = this.editIds[this.editIds.length - 1];
    if (!keepId) return;
    const ids = new Set(this.editIds);
    const title = titleCase(this.editTitle.trim());
    if (this.editMeal) {
      const description = this.editDescription.trim();
      if (!title) return;
      this.commit(
        {
          ...this.state,
          entries: this.state.entries.map((entry) =>
            entry.id === keepId
              ? {
                  ...entry,
                  calories,
                  mealTitle: title,
                  mealDescription: description,
                }
              : entry,
          ),
        },
        [
          {
            type: "entry.patch",
            entityId: keepId,
            body: { calories, mealTitle: title, mealDescription: description },
          },
        ],
      );
    } else {
      this.commit(
        {
          ...this.state,
          entries: this.state.entries.map((entry) => {
            if (entry.id === keepId)
              return { ...entry, calories, mealTitle: title || undefined };
            if (ids.has(entry.id)) return { ...entry, removed: true };
            return entry;
          }),
        },
        [
          {
            type: "entry.patch",
            entityId: keepId,
            body: { calories, mealTitle: title },
          },
          ...this.editIds
            .filter((id) => id !== keepId)
            .map((id) => ({
              type: "entry.remove" as const,
              entityId: id,
            })),
        ],
      );
    }
    this.closeEdit();
  }

  private visibleMeals(): Meal[] {
    return this.state.meals.filter((meal) => !meal.removed);
  }

  private onMealPointerDown(event: PointerEvent, id: string): void {
    if (event.button !== 0) return;
    event.preventDefault();
    this.endMealPointer();
    const handle = event.currentTarget;
    if (handle instanceof HTMLElement)
      handle.setPointerCapture(event.pointerId);
    this.mealPointer = {
      id,
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
    };
    this.mealDragging = id;
    this.kebabKey = "";
    this.mealDropIndex = this.mealDropIndexFrom(event.clientY);
    window.addEventListener("pointermove", this.onMealPointerMove, {
      passive: false,
    });
    window.addEventListener("pointerup", this.onMealPointerUp);
    window.addEventListener("pointercancel", this.onMealPointerUp);
  }

  private endMealPointer(): void {
    window.removeEventListener("pointermove", this.onMealPointerMove);
    window.removeEventListener("pointerup", this.onMealPointerUp);
    window.removeEventListener("pointercancel", this.onMealPointerUp);
  }

  private onMealPointerMove = (event: PointerEvent): void => {
    const drag = this.mealPointer;
    if (!drag || event.pointerId !== drag.pointerId) return;
    if (event.cancelable) event.preventDefault();
    const next = this.mealDropIndexFrom(event.clientY);
    if (next !== this.mealDropIndex) this.mealDropIndex = next;
  };

  private onMealPointerUp = (event: PointerEvent): void => {
    const drag = this.mealPointer;
    if (!drag || event.pointerId !== drag.pointerId) return;
    const id = this.mealDragging;
    const to = this.mealDropIndex;
    this.endMealPointer();
    this.mealPointer = null;
    this.mealDragging = "";
    this.mealDropIndex = -1;
    if (id && to >= 0) this.reorderMeal(id, to);
  };

  private mealDropIndexFrom(clientY: number): number {
    const cards = [
      ...this.renderRoot.querySelectorAll<HTMLElement>("[data-meal-id]"),
    ];
    if (!cards.length) return 0;
    for (let index = 0; index < cards.length; index += 1) {
      const rect = cards[index].getBoundingClientRect();
      if (clientY < rect.top + rect.height / 2) return index;
    }
    return cards.length;
  }

  private reorderMeal(id: string, toGap: number): void {
    const visible = this.visibleMeals();
    const from = visible.findIndex((meal) => meal.id === id);
    if (from < 0 || toGap === from || toGap === from + 1) return;
    const nextVisible = visible.slice();
    const [moved] = nextVisible.splice(from, 1);
    if (!moved) return;
    const insertAt = toGap > from ? toGap - 1 : toGap;
    nextVisible.splice(insertAt, 0, moved);
    const removed = this.state.meals.filter((meal) => meal.removed);
    const meals = [...nextVisible, ...removed];
    this.commit({ ...this.state, meals }, [
      {
        type: "meal.reorder",
        entityId: id,
        count: false,
        body: { ids: meals.map((meal) => meal.id) },
      },
    ]);
  }

  private saveMeal(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const data = new FormData(form);
    const meal: Meal = {
      id: crypto.randomUUID(),
      title: titleCase(String(data.get("title") ?? "").trim()),
      description: String(data.get("description") ?? "").trim(),
      calories: Number(data.get("calories") ?? 0),
    };
    if (!meal.title || !Number.isInteger(meal.calories) || meal.calories < 0)
      return;
    this.commit({ ...this.state, meals: [meal, ...this.state.meals] }, [
      {
        type: "meal.create",
        entityId: meal.id,
        body: {
          title: meal.title,
          description: meal.description,
          calories: meal.calories,
        },
      },
    ]);
    window.history.replaceState({}, "", "/meals");
    this.page = "meals";
    this.closeMenu();
    this.mealPickerOpen = false;
    this.kebabKey = "";
  }

  private updateMeal(event: Event): void {
    event.preventDefault();
    const data = new FormData(event.currentTarget as HTMLFormElement);
    const title = titleCase(String(data.get("title") ?? "").trim());
    const description = String(data.get("description") ?? "").trim();
    const calories = Number(data.get("calories") ?? 0);
    if (!title || !Number.isInteger(calories) || calories < 0) return;
    this.commit(
      {
        ...this.state,
        meals: this.state.meals.map((meal) =>
          meal.id === this.selectedMealId
            ? { ...meal, title, description, calories }
            : meal,
        ),
      },
      [
        {
          type: "meal.update",
          entityId: this.selectedMealId,
          body: { title, description, calories },
        },
      ],
    );
    this.navigate("today");
  }

  private saveGoal(event: Event): void {
    event.preventDefault();
    const form = event.currentTarget as HTMLFormElement;
    const calories = Number(new FormData(form).get("calories") ?? 0);
    if (!Number.isInteger(calories) || calories <= 0) return;
    const setAt = new Date().toISOString();
    const goal = { id: crypto.randomUUID(), calories, setAt };
    this.commit({ ...this.state, goals: [...this.state.goals, goal] }, [
      {
        type: "goal.create",
        entityId: goal.id,
        occurredAt: setAt,
        body: { calories, setAt },
      },
    ]);
    this.navigate("today");
  }

  private openDayGoal(key: string): void {
    this.kebabKey = "";
    this.closeMenu();
    this.mealPickerOpen = false;
    this.closeEdit();
    const current = this.caloriesFor(key);
    this.dayGoalCalories = current === undefined ? "" : String(current);
    this.dayGoalKey = key;
    this.renderRoot.querySelector<HTMLElement>(":focus")?.blur();
  }

  private openFast(key: string): void {
    this.kebabKey = "";
    this.closeMenu();
    this.mealPickerOpen = false;
    this.closeEdit();
    this.fastKey = key;
    this.renderRoot.querySelector<HTMLElement>(":focus")?.blur();
  }

  private setFasted(day: string, fasted: boolean): void {
    const setAt = new Date().toISOString();
    const fast = { id: crypto.randomUUID(), day, fasted, setAt };
    this.commit({ ...this.state, fasts: [...this.state.fasts, fast] }, [
      {
        type: "fast.set",
        entityId: fast.id,
        occurredAt: setAt,
        body: { day, fasted, setAt },
      },
    ]);
  }

  private saveDayGoal(event: Event): void {
    event.preventDefault();
    const key = this.dayGoalKey;
    if (!key) return;
    const form = event.currentTarget as HTMLFormElement;
    const calories = Number(new FormData(form).get("calories") ?? 0);
    if (!Number.isInteger(calories) || calories <= 0) return;
    const setAt = new Date().toISOString();
    const goal = {
      id: crypto.randomUUID(),
      calories,
      setAt,
      day: key,
    };
    this.commit({ ...this.state, goals: [...this.state.goals, goal] }, [
      {
        type: "goal.create",
        entityId: goal.id,
        occurredAt: setAt,
        body: { calories, setAt, day: key },
      },
    ]);
    this.dayGoalKey = "";
  }

  private todayEntries(): CalorieEntry[] {
    const today = todayKey();
    return this.state.entries
      .filter(
        (entry) =>
          !entry.removed && dateKey(new Date(entry.timestamp)) === today,
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  private dayEntries(key: string): CalorieEntry[] {
    return this.state.entries
      .filter(
        (entry) => !entry.removed && dateKey(new Date(entry.timestamp)) === key,
      )
      .sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  }

  private firstLoggedDay(): string {
    let first = "";
    for (const entry of this.state.entries) {
      if (entry.removed || entry.calories <= 0) continue;
      const key = dateKey(new Date(entry.timestamp));
      if (!first || key < first) first = key;
    }
    return first;
  }

  private renderGoalControl(
    goal: number | undefined,
    onClick: () => void,
  ): TemplateResult {
    if (goal) {
      // prettier-ignore
      return html`<span class="calorie-goal">/ <button class="goal-link" type="button" aria-label="Change goal" @click=${onClick}>${goal}</button> calories</span>`;
    }
    // prettier-ignore
    return html`<span class="calorie-goal"><button class="goal-link" type="button" aria-label="Set a goal" @click=${onClick}>/ no goal set</button></span>`;
  }

  private showsCalories(day: string, today: string, first: string): boolean {
    if (day > today) return false;
    if (dayTotal(this.state.entries, day) > 0) return true;
    return Boolean(first) && day < today && day > first;
  }

  private renderFastLink(key: string, ask: string): TemplateResult {
    const text = isFasted(this.state.fasts, key) ? "I fasted today." : ask;
    // prettier-ignore
    return html`<button class="fast-link" type="button" @click=${() => this.openFast(key)}>${text}</button>`;
  }

  private renderDay() {
    const key = this.selectedDayKey;
    const label = formatDayLabel(key, todayKey());
    const total = dayTotal(this.state.entries, key);
    const goal = this.caloriesFor(key);
    const weighted = goal
      ? weightedOver(this.state.entries, key, goal, this.state.fasts)
      : 0;
    const color = goal ? toneColor(weighted) : "var(--ink)";
    const entries = this.dayEntries(key);
    return html`
      <section class="day-summary">
        <p class="day-status">
          <span class="day-kicker">${label}</span>
          ${goal ? html`<span class="status-label">— ${toneLabel(weighted)}</span>` : ""}
        </p>
        <p class="calorie-line">
          <span class="calorie-total" style="color: ${color}">${total}</span>
          ${this.renderGoalControl(goal, () => this.openDayGoal(key))}
        </p>
      </section>
      ${
        entries.length
          ? html`<ul class="entry-list">
              ${shownEntries(entries).map((entry) => this.renderEntry(entry))}
            </ul>`
          : html`<p class="empty-note">Nothing logged this day.</p>
              ${this.renderFastLink(key, "Or did you fast today?")}`
      }
      ${this.renderActionDock()}
    `;
  }

  private renderAimNote(
    goal: number | undefined,
    day: string,
  ): TemplateResult | "" {
    if (!goal) return "";
    const limit = yellowCalories(
      this.state.entries,
      day,
      goal,
      this.state.fasts,
    );
    if (limit === undefined) return "";
    return html`<p class="aim-note">
      Aim for less than ${limit} calories today
    </p>`;
  }

  private renderActionDock() {
    return html`
      <div class="action-dock">
        <button class="calorie-button" @click=${() => this.addCalories(50)}>
          +50
        </button>
        <button class="calorie-button" @click=${() => this.addCalories(100)}>
          +100
        </button>
        <button class="calorie-button" @click=${() => this.addCalories(500)}>
          +500
        </button>
        <button
          class="meal-button"
          aria-haspopup="menu"
          aria-expanded=${this.mealPickerOpen ? "true" : "false"}
          @click=${() => {
            this.kebabKey = "";
            this.mealPickerOpen = !this.mealPickerOpen;
          }}
        >
          Meals
        </button>
      </div>
      ${this.mealPickerOpen ? this.renderMealPicker() : ""}
    `;
  }

  private renderToday() {
    const today = todayKey();
    const total = dayTotal(this.state.entries, today);
    const goal = this.caloriesFor(today);
    const weighted = goal
      ? weightedOver(this.state.entries, today, goal, this.state.fasts)
      : 0;
    const color = goal ? toneColor(weighted) : "var(--ink)";
    return html`
      <section class="day-summary">
        <p class="day-status">
          <span class="day-kicker">Today</span>
          ${goal ? html`<span class="status-label">— ${toneLabel(weighted)}</span>` : ""}
        </p>
        <p class="calorie-line">
          <span class="calorie-total" style="color: ${color}">${total}</span>
          ${this.renderGoalControl(goal, () => this.navigate("goal"))}
        </p>
        ${this.renderAimNote(goal, today)}
      </section>
      ${
        this.todayEntries().length
          ? html`<ul class="entry-list">
              ${shownEntries(this.todayEntries()).map((entry) => this.renderEntry(entry))}
            </ul>`
          : html`<p class="empty-note">
                Nothing logged yet. Add a bite when you eat it.
              </p>
              ${this.renderFastLink(today, "Or did you fast today?")}`
      }
      ${this.renderActionDock()}
    `;
  }

  private renderKebab(key: string, items: TemplateResult) {
    const open = this.kebabKey === key;
    return html`<div class="kebab">
      <button
        class="icon-button"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded=${open ? "true" : "false"}
        @click=${() => this.toggleKebab(key)}
      >
        <svg class="dots" viewBox="0 0 24 24" aria-hidden="true">
          <circle cx="12" cy="5" r="1.6"></circle>
          <circle cx="12" cy="12" r="1.6"></circle>
          <circle cx="12" cy="19" r="1.6"></circle>
        </svg>
      </button>
      ${
        open
          ? html`<div
                class="kebab-backdrop"
                @click=${() => (this.kebabKey = "")}
              ></div>
              <div class="kebab-menu" role="menu">${items}</div>`
          : ""
      }
    </div>`;
  }

  private renderEntry(shown: ShownEntry) {
    const meal = this.state.meals.find((item) => item.id === shown.mealId);
    const title =
      shown.entries.find((entry) => entry.mealTitle)?.mealTitle ?? meal?.title;
    const description = shown.mealId
      ? (shown.entries[0]?.mealDescription?.trim() ?? "")
      : "";
    return html`<li
      class="entry-card ${this.kebabKey === shown.key ? "menu-open" : ""}"
    >
      <div class="entry-row">
        <div class="entry-line">
          <span class="log-amount">
            <button
              class="log-calories"
              type="button"
              @click=${() => this.beginEdit(shown)}
            >
              ${shown.calories}
            </button>
            <span class="log-unit">calories</span>
          </span>
          <span class="log-time-wrap">
            <button
              class="log-time"
              type="button"
              @click=${(event: Event) => this.openClock(shown, event)}
            >
              ${formatTime(shown.timestamp)}
            </button>
            <input
              class="clock-input"
              type="time"
              step="60"
              tabindex="-1"
              aria-hidden="true"
              .value=${timeValue(shown.timestamp)}
              @change=${(event: Event) =>
                this.updateShownTime(
                  shown,
                  (event.target as HTMLInputElement).value,
                )}
            />
          </span>
          ${
            title
              ? meal
                ? html`<button
                    class="log-meal log-meal-inline"
                    type="button"
                    @click=${() => this.openMeal(meal.id)}
                  >
                    ${titleCase(title)}
                  </button>`
                : html`<button
                    class="log-meal log-meal-inline"
                    type="button"
                    @click=${() => this.beginEdit(shown)}
                  >
                    ${titleCase(title)}
                  </button>`
              : ""
          }
        </div>
        ${this.renderKebab(
          shown.key,
          html`<button
              class="popover-button"
              role="menuitem"
              @click=${() => this.beginEdit(shown)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.5 19.5l1.1-4.2L16.2 4.7l3.1 3.1L8.7 18.4z"></path>
                <path d="M13.8 7.1l3.1 3.1"></path>
              </svg>
              <span>Edit</span>
            </button>
            <button
              class="popover-button"
              role="menuitem"
              @click=${(event: Event) => this.openClock(shown, event)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <circle cx="12" cy="12" r="8"></circle>
                <path d="M12 8v4.5l3 2"></path>
              </svg>
              <span>Change time</span>
            </button>
            <button
              class="popover-button kebab-remove"
              role="menuitem"
              @click=${() => this.removeShown(shown)}
            >
              <svg viewBox="0 0 24 24" aria-hidden="true">
                <path d="M4.5 7h15"></path>
                <path d="M9 7V4.5h6V7"></path>
                <path d="M7.5 7l.8 12.5h7.4l.8-12.5"></path>
                <path d="M10 11v5.5"></path>
                <path d="M14 11v5.5"></path>
              </svg>
              <span>Remove</span>
            </button>`,
        )}
      </div>
      ${
        title
          ? meal
            ? html`<button
                class="entry-title-row"
                type="button"
                @click=${() => this.openMeal(meal.id)}
              >
                ${titleCase(title)}
              </button>`
            : html`<button
                class="entry-title-row"
                type="button"
                @click=${() => this.beginEdit(shown)}
              >
                ${titleCase(title)}
              </button>`
          : ""
      }
      ${description ? html`<p class="entry-note">${description}</p>` : ""}
    </li>`;
  }

  private renderEdit() {
    if (!this.editKey) return "";
    return html`<div
      class="edit-sheet"
      @click=${() => this.closeEdit()}
      @keydown=${(event: KeyboardEvent) => {
        if (event.key === "Escape") this.closeEdit();
      }}
    >
      <form
        class="edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="edit-heading"
        @submit=${this.saveEdit}
        @click=${(event: Event) => event.stopPropagation()}
      >
        <h2 id="edit-heading" class="edit-heading">
          ${this.editMeal ? "Edit this serving" : "Edit calories"}
        </h2>
        <label class="field-label" for="edit-use-title">Title</label>
        <input
          class="text-input"
          id="edit-use-title"
          placeholder=${this.editMeal ? "" : "Optional"}
          .value=${live(this.editTitle)}
          ?required=${this.editMeal}
          @input=${(event: Event) => {
            this.editTitle = (event.target as HTMLInputElement).value;
          }}
        />
        ${
          this.editMeal
            ? html`<label class="field-label" for="edit-use-description"
                  >Description</label
                >
                <textarea
                  class="description-input"
                  id="edit-use-description"
                  rows="3"
                  .value=${live(this.editDescription)}
                  @input=${(event: Event) => {
                    this.editDescription = (
                      event.target as HTMLTextAreaElement
                    ).value;
                  }}
                ></textarea>`
            : ""
        }
        <label class="field-label" for="edit-calories">Calories</label>
        <input
          class="number-input edit-calories"
          id="edit-calories"
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          required
          .value=${live(this.editCalories)}
          @input=${(event: Event) => {
            this.editCalories = (event.target as HTMLInputElement).value;
          }}
        />
        <div class="calorie-nudge">
          <div class="nudge-side">
            <button
              class="nudge-button"
              type="button"
              @click=${() => this.nudgeCalories(-100)}
            >
              −100
            </button>
            <button
              class="nudge-button"
              type="button"
              @click=${() => this.nudgeCalories(-25)}
            >
              −25
            </button>
          </div>
          <div class="nudge-side">
            <button
              class="nudge-button nudge-plus"
              type="button"
              @click=${() => this.nudgeCalories(25)}
            >
              +25
            </button>
            <button
              class="nudge-button nudge-plus"
              type="button"
              @click=${() => this.nudgeCalories(100)}
            >
              +100
            </button>
          </div>
        </div>
        <button class="check-button" type="submit" aria-label="Save">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5 10 17.5 19 7.5"></path>
          </svg>
        </button>
      </form>
    </div>`;
  }

  private renderMealPicker() {
    const meals = this.visibleMeals();
    return html`<div
        class="popover-backdrop"
        @click=${() => (this.mealPickerOpen = false)}
      ></div>
      <div class="meal-bubbles" role="menu">
        <button
          class="meal-bubble meal-bubble-create"
          type="button"
          role="menuitem"
          @click=${() => this.openNewMeal()}
        >
          Create a new meal
        </button>
        ${meals.map(
          (meal) =>
            html`<button
              class="meal-bubble"
              type="button"
              role="menuitem"
              @click=${() => this.addCalories(meal.calories, meal.id)}
            >
              <span class="meal-bubble-title">${titleCase(meal.title)}</span>
              <span class="meal-bubble-calories">${meal.calories}</span>
            </button>`,
        )}
      </div>`;
  }

  private showMonth(delta: number): void {
    const next = shiftMonth(this.calendarMonth, delta);
    if (next > monthKey(todayKey())) return;
    this.calendarMonth = next;
  }

  private renderHistory() {
    const today = todayKey();
    const first = this.firstLoggedDay();
    return html`<section>
      <div class="section-heading">
        <h2 class="section-title">Days</h2>
        <div class="view-toggle" role="group" aria-label="History layout">
          <button
            type="button"
            aria-pressed=${this.historyMode === "calendar" ? "true" : "false"}
            @click=${() => (this.historyMode = "calendar")}
          >
            Calendar
          </button>
          <button
            type="button"
            aria-pressed=${this.historyMode === "list" ? "true" : "false"}
            @click=${() => (this.historyMode = "list")}
          >
            List
          </button>
        </div>
      </div>
      ${this.historyMode === "calendar" ? this.renderCalendar(today, first) : this.renderHistoryList(today, first)}
    </section>`;
  }

  private renderHistoryList(today: string, first: string) {
    const days = Array.from({ length: 30 }, (_, index) =>
      addDays(today, -index),
    ).filter((day) => this.showsCalories(day, today, first));
    return html`<ul class="day-list">
      ${days.map((day) => {
        const total = dayTotal(this.state.entries, day);
        const goal = this.caloriesFor(day);
        const color = goal
          ? toneColor(
              weightedOver(this.state.entries, day, goal, this.state.fasts),
            )
          : "var(--ink)";
        return html`<li class="day-card day-link">
          <button
            type="button"
            class="day-button"
            @click=${() => this.openDay(day)}
          >
            <span class="entry-line">
              <span class="log-amount">
                <span class="log-calories" style="color: ${color}"
                  >${total}</span
                >
                <span class="log-unit">calories</span>
              </span>
              <span class="log-unit">${formatDayLabel(day, today)}</span>
            </span>
          </button>
        </li>`;
      })}
    </ul>`;
  }

  private renderCalendar(today: string, first: string) {
    const current = monthKey(today);
    return html`<div class="calendar-card">
      <div class="calendar-nav">
        <button
          class="icon-button"
          type="button"
          aria-label="Previous month"
          @click=${() => this.showMonth(-1)}
        >
          <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M14.5 6.5L8.5 12l6 5.5"></path>
          </svg>
        </button>
        <p class="calendar-month">${monthLabel(this.calendarMonth)}</p>
        <button
          class="icon-button"
          type="button"
          aria-label="Next month"
          ?disabled=${this.calendarMonth >= current}
          @click=${() => this.showMonth(1)}
        >
          <svg class="chevron" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M9.5 6.5l6 5.5-6 5.5"></path>
          </svg>
        </button>
      </div>
      <div class="calendar-grid">
        ${WEEKDAYS.map((day) => html`<span class="calendar-weekday">${day}</span>`)}
        ${monthCells(this.calendarMonth).map((cell) => {
          const happened = cell.key <= today;
          const show = this.showsCalories(cell.key, today, first);
          const total = show ? dayTotal(this.state.entries, cell.key) : 0;
          const goal = this.caloriesFor(cell.key);
          const color =
            show && cell.inMonth && goal
              ? toneColor(
                  weightedOver(
                    this.state.entries,
                    cell.key,
                    goal,
                    this.state.fasts,
                  ),
                )
              : "var(--muted)";
          const classes = `calendar-day ${cell.inMonth ? "" : "outside"} ${cell.key === today ? "is-today" : ""}`;
          return happened
            ? html`<button
                type="button"
                class=${classes}
                @click=${() => this.openDay(cell.key)}
              >
                <span class="calendar-date">${Number(cell.key.slice(-2))}</span>
                ${
                  show
                    ? html`<span
                        class="calendar-calories"
                        style="color: ${color}"
                        >${total}</span
                      >`
                    : ""
                }
              </button>`
            : html`<div class=${classes}>
                <span class="calendar-date">${Number(cell.key.slice(-2))}</span>
              </div>`;
        })}
      </div>
    </div>`;
  }

  private renderMeals() {
    const meals = this.visibleMeals();
    const gap = (index: number) => {
      const on = this.mealDragging !== "" && this.mealDropIndex === index;
      return html`<li class="meal-gap" aria-hidden="true">
        <span class="drop-line ${on ? "is-on" : ""}"></span>
      </li>`;
    };
    return html`<section>
      <ul class="meal-list ${this.mealDragging ? "is-dragging" : ""}">
        ${meals.map((meal, index) => {
          const key = `meal:${meal.id}`;
          return html`${gap(index)}
            <li
              class="meal-card ${this.kebabKey === key ? "menu-open" : ""} ${
                this.mealDragging === meal.id ? "is-dragging" : ""
              }"
              data-meal-id=${meal.id}
            >
              <div class="meal-top">
                <p class="entry-calories">${titleCase(meal.title)}</p>
                ${this.renderKebab(
                  key,
                  html`<button
                      class="popover-button"
                      role="menuitem"
                      @click=${() => this.openMeal(meal.id)}
                    >
                      Edit
                    </button>
                    <button
                      class="popover-button kebab-remove"
                      role="menuitem"
                      @click=${() => this.removeMeal(meal.id)}
                    >
                      Remove
                    </button>`,
                )}
              </div>
              <p class="entry-meta">
                ${meal.description || "No description"} · ${meal.calories}
                calories
              </p>
              <div class="meal-bottom">
                <button
                  class="icon-button meal-drag"
                  type="button"
                  aria-label="Drag to reorder"
                  @pointerdown=${(event: PointerEvent) =>
                    this.onMealPointerDown(event, meal.id)}
                >
                  <svg class="dots" viewBox="0 0 24 24" aria-hidden="true">
                    <circle cx="9" cy="7" r="1.5"></circle>
                    <circle cx="15" cy="7" r="1.5"></circle>
                    <circle cx="9" cy="12" r="1.5"></circle>
                    <circle cx="15" cy="12" r="1.5"></circle>
                    <circle cx="9" cy="17" r="1.5"></circle>
                    <circle cx="15" cy="17" r="1.5"></circle>
                  </svg>
                </button>
              </div>
            </li>`;
        })}
        ${meals.length ? gap(meals.length) : ""}
        <li>
          <button
            class="meal-create"
            type="button"
            @click=${() => this.openNewMeal()}
          >
            Create a new meal
          </button>
        </li>
      </ul>
    </section>`;
  }

  private renderNewMeal() {
    return html`<section>
      <form class="composer-card" @submit=${this.saveMeal}>
        <label class="field-label" for="meal-title">Title</label>
        <input class="text-input" id="meal-title" name="title" required />
        <label class="field-label" for="meal-description">Description</label>
        <textarea
          class="description-input"
          id="meal-description"
          name="description"
          rows="3"
        ></textarea>
        <label class="field-label" for="meal-calories">Calories</label>
        <input
          class="number-input"
          id="meal-calories"
          name="calories"
          type="number"
          min="0"
          required
        />
        <button class="check-button" type="submit" aria-label="Save meal">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5 10 17.5 19 7.5"></path>
          </svg>
        </button>
      </form>
    </section>`;
  }

  private renderMealEdit() {
    const meal = this.state.meals.find(
      (item) => item.id === this.selectedMealId,
    );
    if (!meal)
      return html`<p class="empty-note">That meal is no longer here.</p>`;
    return html`<section>
      <form class="composer-card" @submit=${this.updateMeal}>
        <label class="field-label" for="edit-meal-title">Title</label>
        <input
          class="text-input"
          id="edit-meal-title"
          name="title"
          .value=${titleCase(meal.title)}
          required
        />
        <label class="field-label" for="edit-meal-description"
          >Description</label
        >
        <textarea
          class="description-input"
          id="edit-meal-description"
          name="description"
          rows="3"
          .value=${meal.description}
        ></textarea>
        <label class="field-label" for="edit-meal-calories">Calories</label>
        <input
          class="number-input"
          id="edit-meal-calories"
          name="calories"
          type="number"
          min="0"
          .value=${String(meal.calories)}
          required
        />
        <button class="check-button" type="submit" aria-label="Save changes">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5 10 17.5 19 7.5"></path>
          </svg>
        </button>
      </form>
    </section>`;
  }

  private heading(): string {
    if (this.page === "today") return "Today";
    if (this.page === "history") return "History";
    if (this.page === "day")
      return formatDayLabel(this.selectedDayKey, todayKey());
    if (this.page === "meals") return "Meals";
    if (this.page === "new-meal") return "New meal";
    if (this.page === "goal") return "Goal";
    return "Edit meal";
  }

  private renderGoal() {
    return html`<section>
      <form class="goal-card" @submit=${this.saveGoal}>
        <label class="field-label" for="goal-calories"
          >Calories to stay near</label
        >
        <input
          class="number-input"
          id="goal-calories"
          name="calories"
          type="number"
          min="1"
          .value=${String(this.caloriesFor(todayKey()) ?? 2000)}
        />
        <button class="check-button" type="submit" aria-label="Save goal">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5 10 17.5 19 7.5"></path>
          </svg>
        </button>
        <p class="tone-note">
          The calorie color looks across the last seven days, not just today.
          Today counts in full, yesterday half as much, and each older day a
          little less. At or under this goal the number stays green (On track).
          A modest surplus fades toward yellow (Drifting). About 300 calories
          over that blend reads Running hot, and about 600 over turns red. A day
          under one third of this goal stays green, and a day under two thirds
          stays green or yellow.
        </p>
      </form>
    </section>`;
  }

  private renderAccount() {
    if (this.account.status === "checking") {
      return html`<div class="account-block">
        <p class="account-copy">Checking account…</p>
      </div>`;
    }
    if (this.account.status === "signed-in") {
      const label = this.account.name || this.account.email || "Signed in";
      return html`<div class="account-block">
        <p class="account-name">${label}</p>
      </div>`;
    }
    return html`<div class="account-block">
      <div class="account-actions">
        <button
          class="account-button"
          type="button"
          @click=${() => this.signIn(false)}
        >
          Log in
        </button>
        <button
          class="account-button account-secondary"
          type="button"
          @click=${() => this.signIn(true)}
        >
          Sign up
        </button>
      </div>
    </div>`;
  }

  override render() {
    return html`<div class="app-shell">
      <header class="app-header">
        <div class="header-main">
          <div class="brand">
            <a
              class="brand-mark"
              href="/"
              @click=${(event: Event) => {
                event.preventDefault();
                this.navigate("today");
              }}
              >Nourish</a
            >
            <h1 class="brand-name">${this.heading()}</h1>
          </div>
        </div>
        <button
          class="menu-button"
          @click=${() => this.openMenu()}
          aria-label="Account and menu"
          aria-haspopup="dialog"
          aria-expanded=${this.menuOpen ? "true" : "false"}
        >
          ${
            this.account.status === "signed-in" && this.account.picture
              ? html`<img class="avatar" src=${this.account.picture} alt="" />`
              : this.account.status === "signed-in"
                ? html`<span class="avatar">${this.initials()}</span>`
                : html`<svg
                    class="profile-icon"
                    viewBox="0 0 24 24"
                    aria-hidden="true"
                  >
                    <circle cx="12" cy="12" r="9"></circle>
                    <circle cx="12" cy="10" r="2.2"></circle>
                    <path d="M7.2 17.2a5 5 0 0 1 9.6 0"></path>
                  </svg>`
          }
        </button>
      </header>
      <main class="app-main">
        ${
          this.offline
            ? html`<p class="offline-note" role="status">
                Offline. Your log stays on this device.
              </p>`
            : ""
        }
        ${
          this.syncNote
            ? this.needsReauth()
              ? html`<p class="offline-note" role="status">
                  <button
                    class="sync-reauth"
                    type="button"
                    @click=${() => void this.reauthenticate()}
                  >
                    ${this.syncNote}
                  </button>
                </p>`
              : html`<p class="offline-note" role="status">${this.syncNote}</p>`
            : ""
        }
        ${this.page === "today" ? this.renderToday() : ""}
        ${this.page === "history" ? this.renderHistory() : ""}
        ${this.page === "day" ? this.renderDay() : ""}
        ${this.page === "meals" ? this.renderMeals() : ""}
        ${this.page === "new-meal" ? this.renderNewMeal() : ""}
        ${this.page === "meal" ? this.renderMealEdit() : ""}
        ${this.page === "goal" ? this.renderGoal() : ""}
      </main>
      ${
        this.menuMounted
          ? html`<div
              class="menu-sheet ${this.menuOpen ? "is-open" : ""}"
              @click=${() => this.closeMenu()}
            >
              <nav
                class="menu-panel"
                @click=${(event: Event) => event.stopPropagation()}
              >
                ${this.renderAccount()}
                <button
                  class="menu-link"
                  @click=${() => this.navigate("today")}
                >
                  Today
                </button>
                <button
                  class="menu-link"
                  @click=${() => this.navigate("history")}
                >
                  History
                </button>
                <button
                  class="menu-link"
                  @click=${() => this.navigate("meals")}
                >
                  Meals
                </button>
                <button class="menu-link" @click=${() => this.navigate("goal")}>
                  Goal
                </button>
                <button
                  class="menu-link"
                  type="button"
                  @click=${() => void this.shareApp()}
                >
                  ${this.shareCopied ? "Copied" : "Share"}
                </button>
                ${
                  this.account.status === "signed-in"
                    ? html`<button
                        class="menu-sign-out"
                        type="button"
                        @click=${() =>
                          this.needsReauth()
                            ? void this.reauthenticate()
                            : void this.signOut()}
                      >
                        ${this.needsReauth() ? "Re-authenticate" : "Sign out"}
                      </button>`
                    : ""
                }
              </nav>
            </div>`
          : ""
      }
      ${this.renderEdit()} ${this.renderDayGoal()} ${this.renderFast()}
    </div>`;
  }

  private renderFast() {
    const key = this.fastKey;
    if (!key) return "";
    const fasted = isFasted(this.state.fasts, key);
    const assumed = this.caloriesFor(key) ?? UNTRACKED_FALLBACK;
    const close = () => {
      this.fastKey = "";
    };
    return html`<div
      class="edit-sheet"
      @click=${close}
      @keydown=${(event: KeyboardEvent) => {
        if (event.key === "Escape") close();
      }}
    >
      <div
        class="edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="fast-heading"
        @click=${(event: Event) => event.stopPropagation()}
      >
        <h2 id="fast-heading" class="edit-heading">Did you fast?</h2>
        <p class="tone-note">
          ${
            fasted
              ? "This day will be counted as 0 calories because you marked it as a fast."
              : `This day will be counted as ${assumed} calories for the purpose of goal tracking since no food was logged.`
          }
        </p>
        <div class="fast-row">
          <span id="fast-switch-label">I fasted today</span>
          <button
            class="fast-switch"
            type="button"
            role="switch"
            aria-checked=${fasted ? "true" : "false"}
            aria-labelledby="fast-switch-label"
            @click=${() => this.setFasted(key, !fasted)}
          ></button>
        </div>
        <p class="tone-note">
          Turn on this toggle if you actually did not eat anything today.
        </p>
      </div>
    </div>`;
  }

  private renderDayGoal() {
    if (!this.dayGoalKey) return "";
    const label = formatDayLabel(this.dayGoalKey, todayKey());
    return html`<div
      class="edit-sheet"
      @click=${() => {
        this.dayGoalKey = "";
      }}
      @keydown=${(event: KeyboardEvent) => {
        if (event.key === "Escape") this.dayGoalKey = "";
      }}
    >
      <form
        class="edit-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="day-goal-heading"
        @submit=${this.saveDayGoal}
        @click=${(event: Event) => event.stopPropagation()}
      >
        <h2 id="day-goal-heading" class="edit-heading">Goal for ${label}</h2>
        <p class="tone-note">Only this day. Other days stay the same.</p>
        <label class="field-label" for="day-goal-calories">Calories</label>
        <input
          class="number-input"
          id="day-goal-calories"
          name="calories"
          type="number"
          inputmode="numeric"
          min="1"
          step="1"
          required
          .value=${live(this.dayGoalCalories)}
          @input=${(event: Event) => {
            this.dayGoalCalories = (event.target as HTMLInputElement).value;
          }}
        />
        <button class="check-button" type="submit" aria-label="Save goal">
          <svg viewBox="0 0 24 24" aria-hidden="true">
            <path d="M5 12.5 10 17.5 19 7.5"></path>
          </svg>
        </button>
      </form>
    </div>`;
  }
}
