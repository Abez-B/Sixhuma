import { describe, it, expect } from "vitest";
import { toast } from "../lib/core/toast.svelte";

describe("ToastStore", () => {
  it("adds toasts and removes them manually", () => {
    toast.success("Meeting joined!", 0);
    expect(toast.toasts.length).toBeGreaterThanOrEqual(1);

    const created = toast.toasts.find((t) => t.message === "Meeting joined!");
    expect(created).toBeDefined();
    expect(created?.type).toBe("success");

    if (created) {
      toast.removeToast(created.id);
      expect(toast.toasts.find((t) => t.id === created.id)).toBeUndefined();
    }
  });

  it("creates error, info, and warning toasts correctly", () => {
    toast.error("Failed connection", 0);
    toast.info("Announcement received", 0);
    toast.warning("Check network", 0);

    const err = toast.toasts.find((t) => t.message === "Failed connection");
    const info = toast.toasts.find((t) => t.message === "Announcement received");
    const warn = toast.toasts.find((t) => t.message === "Check network");

    expect(err?.type).toBe("error");
    expect(info?.type).toBe("info");
    expect(warn?.type).toBe("warning");
  });
});
