import { describe, it, expect, beforeEach } from "vitest";
import { ChatStore } from "../lib/core/chatStore.svelte";

describe("ChatStore", () => {
  let store: ChatStore;

  beforeEach(() => {
    store = new ChatStore();
  });

  it("adds and deduplicates incoming global chat messages", () => {
    const msg = {
      id: "msg-1",
      meetingCode: "TEST",
      peerId: "peer-a",
      displayName: "Alice",
      text: "Hello everyone",
      timestamp: new Date().toISOString(),
    };

    store.handleIncomingGlobal(msg, "peer-b");
    expect(store.globalMessages).toHaveLength(1);
    expect(store.globalMessages[0].text).toBe("Hello everyone");
    expect(store.unreadGlobalCount).toBe(1);

    // Duplicate message should not be added again
    store.handleIncomingGlobal(msg, "peer-b");
    expect(store.globalMessages).toHaveLength(1);
    expect(store.unreadGlobalCount).toBe(1);
  });

  it("manages direct messages per conversation pair and tracks unread state", () => {
    const dm = {
      id: "dm-1",
      meetingCode: "TEST",
      peerId: "alice",
      toPeerId: "bob",
      displayName: "Alice",
      text: "Hey Bob!",
      timestamp: new Date().toISOString(),
    };

    store.handleIncomingDm(dm, "bob");
    const bobMsgs = store.getDmMessages("bob", "alice");
    expect(bobMsgs).toHaveLength(1);
    expect(bobMsgs[0].text).toBe("Hey Bob!");
    expect(store.unreadDms.length).toBe(1);

    store.markDmRead("bob", "alice");
    expect(store.unreadDms.length).toBe(0);
  });

  it("seeds and sorts global messages chronologically", () => {
    const now = Date.now();
    const older = {
      id: "m-1",
      meetingCode: "TEST",
      peerId: "p1",
      displayName: "One",
      text: "First",
      timestamp: new Date(now - 5000).toISOString(),
    };
    const newer = {
      id: "m-2",
      meetingCode: "TEST",
      peerId: "p2",
      displayName: "Two",
      text: "Second",
      timestamp: new Date(now).toISOString(),
    };

    store.seedGlobal([newer, older]);
    expect(store.globalMessages).toHaveLength(2);
    expect(store.globalMessages[0].id).toBe("m-1");
    expect(store.globalMessages[1].id).toBe("m-2");
  });
});
