export type DataLocator = {
  app: string;
  visibility: "private";
  path: string;
};

export class UserDataClient {
  constructor(
    private readonly baseUrl: string,
    private readonly getToken: () => Promise<string>,
    private readonly getIdToken: () => Promise<string | null>,
  ) {}

  async put(input: DataLocator & { data: unknown }): Promise<void> {
    const token = await this.getToken();
    if (!token) throw new Error("Missing access token");
    const idToken = await this.getIdToken();
    const url = new URL(this.baseUrl);
    url.searchParams.set("app", input.app);
    url.searchParams.set("visibility", input.visibility);
    url.searchParams.set("path", input.path);
    const headers: Record<string, string> = {
      Authorization: `Bearer ${token}`,
      "Content-Type": "application/json",
    };
    if (idToken) headers["X-ID-Token"] = idToken;
    const response = await fetch(url, {
      method: "PUT",
      headers,
      body: JSON.stringify({ data: input.data }),
    });
    if (!response.ok) {
      throw new Error(`Identity put failed (${response.status})`);
    }
  }
}
