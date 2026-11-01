import { describe, it, expect } from "vitest";
import { StateMachine } from "../StateMachine";

describe("StateMachine", () => {
  it("initializes with default state", () => {
    const sm = new StateMachine();
    expect(sm.state.phase).toBe("idle");
    expect(sm.state.room).toBeNull();
    expect(sm.state.waitingRoom).toEqual([]);
    expect(sm.state.selfPeerId).toBeNull();
    expect(sm.state.hostSecret).toBeNull();
  });

  it("handles FullState event and detects waiting vs active phase", () => {
    const sm = new StateMachine("peer-1");

    sm.apply({
      type: "FullState",
      payload: {
        meetingCode: "A1B2",
        eventName: "Demo Session",
        hostPeerId: "peer-host",
        startedAt: new Date().toISOString(),
        waitingRoomEnabled: true,
        participants: {
          "peer-1": {
            peerId: "peer-1",
            displayName: "Alice",
            role: "Attendee",
            isAdmitted: false,
            joinedAt: new Date().toISOString(),
            json: "{}",
          },
        },
      },
    });

    expect(sm.state.phase).toBe("waiting");
    expect(sm.state.room?.meetingCode).toBe("A1B2");
    expect(sm.state.room?.participants["peer-1"].displayName).toBe("Alice");

    sm.apply({ type: "ParticipantAdmitted" });
    expect(sm.state.phase).toBe("active");
  });

  it("handles ParticipantJoined and ParticipantLeft events", () => {
    const sm = new StateMachine("peer-1");
    sm.apply({
      type: "FullState",
      payload: {
        meetingCode: "A1B2",
        eventName: "Demo Session",
        hostPeerId: "peer-host",
        startedAt: new Date().toISOString(),
        waitingRoomEnabled: false,
        participants: {},
      },
    });

    sm.apply({
      type: "ParticipantJoined",
      payload: {
        peerId: "peer-2",
        displayName: "Bob",
        role: "Attendee",
        isAdmitted: true,
        joinedAt: new Date().toISOString(),
        json: "{}",
      },
    });

    expect(sm.state.room?.participants["peer-2"]).toBeDefined();
    expect(sm.state.room?.participants["peer-2"].displayName).toBe("Bob");

    sm.apply({
      type: "ParticipantLeft",
      payload: { peerId: "peer-2" },
    });

    expect(sm.state.room?.participants["peer-2"]).toBeUndefined();
  });

  it("handles RoleChanged and HostChanged events", () => {
    const sm = new StateMachine("peer-1");
    sm.apply({
      type: "FullState",
      payload: {
        meetingCode: "A1B2",
        eventName: "Demo Session",
        hostPeerId: "peer-1",
        startedAt: new Date().toISOString(),
        waitingRoomEnabled: false,
        participants: {
          "peer-2": {
            peerId: "peer-2",
            displayName: "Bob",
            role: "Attendee",
            isAdmitted: true,
            joinedAt: new Date().toISOString(),
            json: "{}",
          },
        },
      },
    });

    sm.apply({
      type: "RoleChanged",
      payload: { peerId: "peer-2", newRole: "Speaker" },
    });

    expect(sm.state.room?.participants["peer-2"].role).toBe("Speaker");

    sm.apply({
      type: "HostChanged",
      payload: { newHostPeerId: "peer-2" },
    });

    expect(sm.state.room?.hostPeerId).toBe("peer-2");
  });

  it("handles HostSecretSet and resets cleanly on MeetingEnded", () => {
    const sm = new StateMachine("peer-1");
    sm.apply({
      type: "HostSecretSet",
      payload: { secret: "sec-12345" },
    });
    expect(sm.state.hostSecret).toBe("sec-12345");

    sm.apply({ type: "MeetingEnded" });
    expect(sm.state.phase).toBe("ended");
    expect(sm.state.room).toBeNull();
    expect(sm.state.hostSecret).toBeNull();
  });
});
