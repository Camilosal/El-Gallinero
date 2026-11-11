import { vi } from "vitest";

vi.mock("@/lib/auth", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/lib/auth")>();
  return {
    ...actual,
    getSessionUser: vi.fn().mockResolvedValue({
      id: "test-user",
      username: "test",
      name: "Test User",
      role: "admin",
    }),
  };
});
