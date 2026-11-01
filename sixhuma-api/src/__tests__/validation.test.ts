import { describe, it, expect } from "vitest";
import {
  CreateMeetingSchema,
  JoinMeetingSchema,
  ClaimHostSchema,
  SendChatMessageSchema,
  SendReactionSchema,
  ChangeRoleSchema,
} from "../lib/validation";

describe("Validation Schemas", () => {
  it("validates CreateMeetingSchema", () => {
    const valid = CreateMeetingSchema.safeParse({
      eventName: "Demo Event",
      peerId: "peer-123",
      profileJson: "{}",
    });
    expect(valid.success).toBe(true);

    const invalid = CreateMeetingSchema.safeParse({
      eventName: "",
      peerId: "peer-123",
    });
    expect(invalid.success).toBe(false);
  });

  it("validates JoinMeetingSchema", () => {
    const valid = JoinMeetingSchema.safeParse({
      meetingCode: "A1B2",
      displayName: "Alice",
      peerId: "peer-456",
      hostSecret: "sec-123",
    });
    expect(valid.success).toBe(true);

    const missingName = JoinMeetingSchema.safeParse({
      meetingCode: "A1B2",
      displayName: "",
      peerId: "peer-456",
    });
    expect(missingName.success).toBe(false);
  });

  it("validates ClaimHostSchema", () => {
    const valid = ClaimHostSchema.safeParse({
      meetingCode: "A1B2",
      peerId: "peer-host",
      proof: "base64proof==",
    });
    expect(valid.success).toBe(true);
  });

  it("validates SendChatMessageSchema", () => {
    const valid = SendChatMessageSchema.safeParse({
      meetingCode: "A1B2",
      text: "Hello everyone!",
    });
    expect(valid.success).toBe(true);

    const empty = SendChatMessageSchema.safeParse({
      meetingCode: "A1B2",
      text: "   ",
    });
    expect(empty.success).toBe(false);
  });

  it("validates ChangeRoleSchema", () => {
    const valid = ChangeRoleSchema.safeParse({
      meetingCode: "A1B2",
      peerId: "peer-1",
      newRole: "Speaker",
    });
    expect(valid.success).toBe(true);

    const invalidRole = ChangeRoleSchema.safeParse({
      meetingCode: "A1B2",
      peerId: "peer-1",
      newRole: "SuperAdmin",
    });
    expect(invalidRole.success).toBe(false);
  });
});
