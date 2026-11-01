import { z } from "zod";

export const CreateMeetingSchema = z.object({
  eventName: z.string({ required_error: "Event name is required" }).trim().min(1, "Event name cannot be empty").max(100),
  peerId: z.string({ required_error: "Peer ID is required" }).trim().min(1).max(128),
  profileJson: z.string().max(65536).optional().default("{}"),
  subtitle: z.string().trim().max(200).optional(),
  description: z.string().trim().max(2000).optional(),
});

export const JoinMeetingSchema = z.object({
  meetingCode: z.string({ required_error: "Meeting code is required" }).trim().min(1).max(10),
  displayName: z.string({ required_error: "Display name is required" }).trim().min(1, "Display name cannot be empty").max(80),
  peerId: z.string({ required_error: "Peer ID is required" }).trim().min(1).max(128),
  profileJson: z.string().max(65536).optional().default("{}"),
  hostSecret: z.string().max(128).optional(),
  proof: z.string().max(256).optional(),
});

export const ClaimHostSchema = z.object({
  meetingCode: z.string({ required_error: "Meeting code is required" }).trim().min(1).max(10),
  peerId: z.string({ required_error: "Peer ID is required" }).trim().min(1).max(128),
  hostSecret: z.string().max(128).optional(),
  proof: z.string().max(256).optional(),
});

export const AdmitParticipantSchema = z.object({
  meetingCode: z.string({ required_error: "Meeting code is required" }).trim().min(1).max(10),
  peerId: z.string({ required_error: "Peer ID is required" }).trim().min(1).max(128),
});

export const KickParticipantSchema = z.object({
  meetingCode: z.string({ required_error: "Meeting code is required" }).trim().min(1).max(10),
  peerId: z.string({ required_error: "Peer ID is required" }).trim().min(1).max(128),
});

export const ChangeRoleSchema = z.object({
  meetingCode: z.string({ required_error: "Meeting code is required" }).trim().min(1).max(10),
  peerId: z.string({ required_error: "Peer ID is required" }).trim().min(1).max(128),
  newRole: z.enum(["Host", "Organizer", "Speaker", "Attendee", "Presentation"]),
});

export const ToggleWaitingRoomSchema = z.object({
  meetingCode: z.string({ required_error: "Meeting code is required" }).trim().min(1).max(10),
  isEnabled: z.boolean(),
});

export const UpdateMetadataSchema = z.object({
  meetingCode: z.string().trim().min(1).max(10).optional(),
  json: z.string().max(65536),
});

export const HeartbeatSchema = z.object({
  meetingCode: z.string().trim().min(1).max(10).optional(),
});

export const CloseMeetingSchema = z.object({
  meetingCode: z.string({ required_error: "Meeting code is required" }).trim().min(1).max(10),
});

export const SendReactionSchema = z.object({
  meetingCode: z.string().trim().min(1).max(10).optional(),
  emoji: z.string().trim().min(1).max(16),
});

export const SendChatMessageSchema = z.object({
  meetingCode: z.string().trim().min(1).max(10).optional(),
  text: z.string({ required_error: "Message cannot be empty" }).trim().min(1, "Message cannot be empty").max(500),
});

export const SendDirectMessageSchema = z.object({
  meetingCode: z.string().trim().min(1).max(10).optional(),
  toPeerId: z.string({ required_error: "Recipient is required" }).trim().min(1).max(128),
  text: z.string({ required_error: "Message cannot be empty" }).trim().min(1, "Message cannot be empty").max(500),
});

export const SendAnnouncementSchema = z.object({
  meetingCode: z.string().trim().min(1).max(10).optional(),
  message: z.string({ required_error: "Message cannot be empty" }).trim().min(1, "Message cannot be empty").max(500),
  hostName: z.string().trim().max(80).optional(),
});
