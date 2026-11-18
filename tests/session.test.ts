import { beforeAll, describe, expect, it } from "vitest";
import { checkPassword, createSessionToken, verifySessionToken } from "../src/lib/session";

beforeAll(() => {
  process.env.SESSION_SECRET = "x".repeat(40);
  process.env.APP_PASSWORD = "hunter2";
});

describe("session", () => {
  it("round-trips a valid token", async () => {
    expect(await verifySessionToken(await createSessionToken())).toBe(true);
  });

  it("rejects tampered, expired and missing tokens", async () => {
    const t = await createSessionToken();
    const [exp, sig] = t.split(".");
    expect(await verifySessionToken(`${Number(exp) + 1}.${sig}`)).toBe(false);
    expect(await verifySessionToken(`${Date.now() - 1000}.${sig}`)).toBe(false);
    expect(await verifySessionToken(undefined)).toBe(false);
    expect(await verifySessionToken("garbage")).toBe(false);
  });

  it("checks password", async () => {
    expect(await checkPassword("hunter2")).toBe(true);
    expect(await checkPassword("hunter3")).toBe(false);
    expect(await checkPassword("")).toBe(false);
  });
});
