import { Router, type IRouter } from "express";
import { Server, type Socket } from "socket.io";
import { type Server as HTTPServer } from "http";
import crypto from "node:crypto";
import { v4 as uuidv4 } from "uuid";
import { logger } from "../lib/logger";
import { storage } from "../services/storage";
import {
  CreateMeetingSchema,
  JoinMeetingSchema,
  ClaimHostSchema,
  AdmitParticipantSchema,
  KickParticipantSchema,
  ChangeRoleSchema,
  ToggleWaitingRoomSchema,
  UpdateMetadataSchema,
  HeartbeatSchema,
  CloseMeetingSchema,
  SendReactionSchema,
  SendChatMessageSchema,
  SendDirectMessageSchema,
  SendAnnouncementSchema,
} from "../lib/validation";
import {
  chatRateLimiter,
  dmRateLimiter,
  reactionRateLimiter,
  createMeetingRateLimiter,
  announcementRateLimiter,
} from "../lib/rateLimit";

export interface Participant {
  peerId: string;
  displayName: string;
  connectionId: string;
  role: 'Host' | 'Organizer' | 'Speaker' | 'Attendee' | 'Presentation';
  isAdmitted: boolean;
  joinedAt: string;
  json: string;
  lastHeartbeat: number;
}

export interface Meeting {
  code: string;
  eventName: string;
  subtitle?: string;
  description?: string;
  hostPeerId: string;
  hostSecret: string;
  participants: Map<string, Participant>;
  kickedPeers: Set<string>;
  waitingRoom: boolean;
  createdAt: number;
  messages: ChatMessage[];
  /** Timer handle for auto-expiry when all participants leave */
  expiryTimer?: ReturnType<typeof setTimeout>;
}

export interface ChatMessage {
  id: string;
  meetingCode: string;
  peerId: string;
  displayName: string;
  text: string;
  timestamp: string;
  avatarUrl?: string;
  toPeerId?: string;
}

export interface WaitingPeer {
  peerId: string;
  displayName: string;
  joinedAt: string;
}

function getWaitingPeers(meeting: Meeting): WaitingPeer[] {
  const list: WaitingPeer[] = [];
  for (const p of meeting.participants.values()) {
    if (!p.isAdmitted) {
      list.push({
        peerId: p.peerId,
        displayName: p.displayName,
        joinedAt: p.joinedAt,
      });
    }
  }
  return list;
}

const meetings = new Map<string, Meeting>();
const peerToMeeting = new Map<string, string>();
const peerToParticipant = new Map<string, Participant>();

// Restore meetings from persistent storage on startup
storage.loadMeetings().then((restored) => {
  for (const item of restored) {
    const participantsMap = new Map<string, Participant>();
    for (const p of item.participants) {
      participantsMap.set(p.peerId, {
        peerId: p.peerId,
        displayName: p.displayName,
        connectionId: '',
        role: p.role,
        isAdmitted: p.isAdmitted,
        joinedAt: p.joinedAt,
        json: p.json,
        lastHeartbeat: Date.now(),
      });
      peerToMeeting.set(p.peerId, item.code);
    }

    meetings.set(item.code, {
      code: item.code,
      eventName: item.eventName,
      subtitle: item.subtitle,
      description: item.description,
      hostPeerId: item.hostPeerId,
      hostSecret: item.hostSecret || uuidv4(),
      participants: participantsMap,
      kickedPeers: new Set(item.kickedPeers || []),
      waitingRoom: item.waitingRoom,
      createdAt: item.createdAt,
      messages: item.messages || [],
    });
  }
  if (restored.length > 0) {
    logger.info({ restored: restored.length }, "Meetings restored from database/storage");
  }
}).catch((err) => {
  logger.error({ err }, "Error restoring meetings from storage");
});

// ── Rate limiting — joins per IP ───────────────────────────────────────────
const joinRateMap = new Map<string, { count: number; resetAt: number }>();
const JOIN_RATE_LIMIT = 50; // max joins
const JOIN_RATE_WINDOW = 10_000; // per 10 seconds

function checkJoinRateLimit(ip: string): boolean {
  const now = Date.now();
  const entry = joinRateMap.get(ip);
  if (!entry || now > entry.resetAt) {
    joinRateMap.set(ip, { count: 1, resetAt: now + JOIN_RATE_WINDOW });
    return true;
  }
  if (entry.count >= JOIN_RATE_LIMIT) return false;
  entry.count++;
  return true;
}

// ── Disconnect buffer config ───────────────────────────────────────────────
const DISCONNECT_BUFFER_MS = 5 * 60_000; // 5 minutes
const disconnectTimers = new Map<string, NodeJS.Timeout>();

// ── Meeting expiry ─────────────────────────────────────────────────────────
const EMPTY_MEETING_TTL_MS = 30 * 60_000; // 30 minutes

function scheduleExpiryIfEmpty(meeting: Meeting, io: Server) {
  if (meeting.participants.size > 0) return;
  clearTimeout(meeting.expiryTimer);
  meeting.expiryTimer = setTimeout(() => {
    if (meeting.participants.size === 0) {
      meetings.delete(meeting.code);
      logger.info({ code: meeting.code }, "Auto-expired empty meeting");
    }
  }, EMPTY_MEETING_TTL_MS);
}

const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
function generateCode(): string {
  let result = "";
  for (let i = 0; i < 4; i++) {
    result += CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)];
  }
  return result;
}

// ── Security & Authentication Helpers ──────────────────────────────────────
function verifyHostProof(meetingCode: string, peerId: string, hostSecret: string, proof: string): boolean {
  try {
    const expected = crypto
      .createHmac("sha256", hostSecret)
      .update(`${meetingCode.toUpperCase()}:${peerId}`)
      .digest("base64");
    if (expected.length !== proof.length) return false;
    return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(proof));
  } catch {
    return false;
  }
}

function isAuthorizedHost(
  meeting: Meeting,
  peerId: string,
  credentials?: { hostSecret?: string; proof?: string },
): boolean {
  if (!credentials || !meeting.hostSecret) return false;
  if (credentials.hostSecret && credentials.hostSecret === meeting.hostSecret) {
    return true;
  }
  if (credentials.proof && verifyHostProof(meeting.code, peerId, meeting.hostSecret, credentials.proof)) {
    return true;
  }
  return false;
}

function isHostCaller(socket: Socket, meeting: Meeting): boolean {
  const callerPeerId = socket.data?.peerId;
  if (!callerPeerId) return false;
  return socket.data?.isHost === true && callerPeerId === meeting.hostPeerId;
}

function isHostOrOrganizerCaller(socket: Socket, meeting: Meeting): boolean {
  const callerPeerId = socket.data?.peerId;
  if (!callerPeerId) return false;
  const caller = meeting.participants.get(callerPeerId);
  if (!caller) return false;
  if (caller.role === "Host" && socket.data?.isHost === true) return true;
  if (caller.role === "Organizer") return true;
  return false;
}

export function setupSocketIO(server: HTTPServer) {
  const io = new Server(server, {
    cors: {
      origin: process.env["ALLOWED_ORIGIN"] || "*",
      methods: ["GET", "POST"],
    },
  });

  // ── Heartbeat watchdog (runs every 15s) ──────────────────────────────────
  const heartbeatInterval = setInterval(() => {
    const now = Date.now();
    for (const [code, meeting] of meetings) {
      for (const [peerId, participant] of meeting.participants) {
        // Never kick the meeting host due to idle or heartbeat delay
        if (peerId === meeting.hostPeerId) continue;

        // If the socket is still connected, the tab is simply idle/in background. Do NOT kick!
        const targetSocket = io.sockets.sockets.get(participant.connectionId);
        if (targetSocket && targetSocket.connected) {
          continue;
        }

        // Only kick if socket is completely disconnected AND 5-minute buffer expired
        if (now - participant.lastHeartbeat > DISCONNECT_BUFFER_MS) {
          logger.info({ peerId, code }, "Purging participant: 5-minute disconnect buffer expired");
          if (targetSocket) {
            targetSocket.emit("Kicked", { meetingCode: code, reason: "heartbeat_timeout" });
            targetSocket.leave(code);
          }
          meeting.participants.delete(peerId);
          peerToMeeting.delete(peerId);
          peerToParticipant.delete(peerId);
          io.to(code).emit("ParticipantLeft", { peerId });
        }
      }
      scheduleExpiryIfEmpty(meeting, io);
    }
  }, 15_000);

  // Hourly purge of abandoned meetings (> 48 hours old and 0 connected sockets)
  setInterval(() => {
    const now = Date.now();
    const MAX_AGE_MS = 48 * 60 * 60 * 1000;
    for (const [code, meeting] of meetings.entries()) {
      if (now - meeting.createdAt > MAX_AGE_MS) {
        let hasActiveSockets = false;
        for (const p of meeting.participants.values()) {
          const s = io.sockets.sockets.get(p.connectionId);
          if (s && s.connected) {
            hasActiveSockets = true;
            break;
          }
        }
        if (!hasActiveSockets) {
          logger.info({ code, createdAt: meeting.createdAt }, "Purging expired abandoned meeting");
          meetings.delete(code);
          storage.scheduleSave(meetings);
        }
      }
    }
  }, 60 * 60 * 1000).unref?.();

  io.on("connection", (socket: Socket) => {
    logger.info({ socketId: socket.id }, "Client connected");
    const remoteIp = (socket.handshake.headers["x-forwarded-for"] as string)?.split(",")[0]?.trim()
      ?? socket.handshake.address;

    socket.on("create_meeting", async (
      rawData: unknown,
      callback?: (err?: any) => void,
    ) => {
      try {
        const parsed = CreateMeetingSchema.safeParse(rawData);
        if (!parsed.success) {
          const errDetail = parsed.error.issues[0]?.message || "Invalid meeting creation payload";
          socket.emit("Error", { code: "BAD_REQUEST", detail: errDetail });
          if (callback) callback({ code: "BAD_REQUEST", detail: errDetail });
          return;
        }
        const data = parsed.data;
        const clientIp = remoteIp || socket.id;
        if (!createMeetingRateLimiter.allow(clientIp)) {
          socket.emit("Error", { code: "RATE_LIMITED", detail: "Too many meetings created. Please wait a moment." });
          if (callback) callback({ code: "RATE_LIMITED", detail: "Too many meetings created. Please wait a moment." });
          return;
        }

        // Code collision retry loop
        let code = generateCode();
        let attempts = 0;
        while (meetings.has(code) && attempts < 100) {
          code = generateCode();
          attempts++;
        }
        if (meetings.has(code)) {
          throw new Error("Unable to allocate unique meeting code. Please try again.");
        }

        const hostSecret = uuidv4();

        let displayName = "Host";
        try {
          const profile = JSON.parse(data.profileJson || "{}");
          if (profile.name) displayName = String(profile.name).slice(0, 80);
        } catch {}

        const meeting: Meeting = {
          code,
          eventName: data.eventName,
          subtitle: data.subtitle,
          description: data.description,
          hostPeerId: data.peerId,
          hostSecret,
          participants: new Map(),
          kickedPeers: new Set(),
          waitingRoom: false,
          createdAt: Date.now(),
          messages: [],
        };

        const host: Participant = {
          peerId: data.peerId,
          displayName,
          connectionId: socket.id,
          role: "Host",
          isAdmitted: true,
          joinedAt: new Date().toISOString(),
          json: data.profileJson || "{}",
          lastHeartbeat: Date.now(),
        };

        meeting.participants.set(data.peerId, host);
        meetings.set(code, meeting);
        peerToMeeting.set(data.peerId, code);
        peerToParticipant.set(data.peerId, host);

        socket.join(code);
        socket.join(`peer:${data.peerId}`);
        socket.data = { meetingCode: code, peerId: data.peerId, isHost: true };

        socket.emit("MeetingCreated", { meetingCode: code, hostSecret });
        socket.emit("FullState", {
          meetingCode: code,
          eventName: data.eventName,
          hostPeerId: data.peerId,
          waitingRoomEnabled: false,
          participants: { [data.peerId]: host },
          messages: [],
        });

        storage.scheduleSave(meetings);

        if (callback) callback();
      } catch (error: any) {
        logger.error({ error }, "Error creating meeting");
        if (callback) callback({ code: "ERROR", detail: error.message });
      }
    });

    socket.on("join_meeting", (
      rawData: unknown,
      callback?: (err?: any) => void,
    ) => {
      try {
        if (!checkJoinRateLimit(remoteIp)) {
          socket.emit("Error", { code: "RATE_LIMITED", detail: "Too many join requests. Please wait." });
          if (callback) callback({ code: "RATE_LIMITED" });
          return;
        }

        const parsed = JoinMeetingSchema.safeParse(rawData);
        if (!parsed.success) {
          const errDetail = parsed.error.issues[0]?.message || "Invalid join payload";
          socket.emit("Error", { code: "BAD_REQUEST", detail: errDetail });
          if (callback) callback({ code: "BAD_REQUEST", detail: errDetail });
          return;
        }
        const data = parsed.data;
        const code = data.meetingCode.toUpperCase();
        const meeting = meetings.get(code);

        if (!meeting) {
          socket.emit("Error", { code: "NOT_FOUND", detail: "Meeting not found" });
          if (callback) callback({ code: "NOT_FOUND", detail: "Meeting not found" });
          return;
        }

        // Check if peer was kicked/removed from this room
        if (meeting.kickedPeers?.has(data.peerId)) {
          socket.emit("Kicked", { meetingCode: code, reason: "You have been removed from this room by the host." });
          socket.emit("Error", { code: "KICKED", detail: "You have been removed from this room by the host." });
          if (callback) callback({ code: "KICKED", detail: "You have been removed from this room by the host." });
          return;
        }

        // Cancel any pending disconnect purge timer for this peer
        const timerKey = `${code}:${data.peerId}`;
        const pendingTimer = disconnectTimers.get(timerKey);
        if (pendingTimer) {
          clearTimeout(pendingTimer);
          disconnectTimers.delete(timerKey);
          logger.info({ peerId: data.peerId, code }, "Cancelled disconnect timer — peer rejoined within buffer");
        }

        const isAuthorizedAsHost = isAuthorizedHost(meeting, data.peerId, {
          hostSecret: data.hostSecret,
          proof: data.proof,
        });

        // ── Reconnect deduplication ───────────────────────────────────────
        const existingParticipant = meeting.participants.get(data.peerId);
        if (existingParticipant) {
          existingParticipant.connectionId = socket.id;
          existingParticipant.lastHeartbeat = Date.now();
          if (data.displayName) existingParticipant.displayName = data.displayName;
          if (data.profileJson) existingParticipant.json = data.profileJson;

          const isHostRole = isAuthorizedAsHost || (data.peerId === meeting.hostPeerId && isAuthorizedAsHost);
          if (isHostRole) {
            existingParticipant.role = "Host";
            existingParticipant.isAdmitted = true;
          } else if (existingParticipant.role === "Host" && !isAuthorizedAsHost) {
            existingParticipant.role = "Attendee";
          }

          peerToParticipant.set(data.peerId, existingParticipant);

          socket.join(code);
          socket.join(`peer:${data.peerId}`);
          socket.data = { meetingCode: code, peerId: data.peerId, isHost: isHostRole };

          // Send full state to reconnecting participant
          socket.emit("FullState", {
            meetingCode: code,
            eventName: meeting.eventName,
            hostPeerId: meeting.hostPeerId,
            waitingRoomEnabled: meeting.waitingRoom,
            participants: Object.fromEntries(meeting.participants),
            messages: meeting.messages,
          });

          if (!existingParticipant.isAdmitted) {
            socket.emit("WaitingForAdmission", { meetingCode: code });
          } else {
            socket.to(code).emit("ParticipantJoined", existingParticipant);
          }

          if (existingParticipant.role === "Host" || existingParticipant.role === "Organizer") {
            socket.emit("WaitingRoomUpdate", getWaitingPeers(meeting));
          }

          if (callback) callback({ status: "ok" });
          return;
        }

        // Check if in a DIFFERENT meeting — clean up first
        const existingMeeting = peerToMeeting.get(data.peerId);
        if (existingMeeting && existingMeeting !== code) {
          socket.leave(existingMeeting);
          const prevMeeting = meetings.get(existingMeeting);
          if (prevMeeting) {
            prevMeeting.participants.delete(data.peerId);
            scheduleExpiryIfEmpty(prevMeeting, io);
          }
          peerToMeeting.delete(data.peerId);
          peerToParticipant.delete(data.peerId);
        }

        let role: Participant["role"] = "Attendee";
        let isHost = false;
        if (data.displayName.toLowerCase().includes("present")) {
          role = "Presentation";
        } else if (isAuthorizedAsHost) {
          role = "Host";
          isHost = true;
        }

        const isAdmitted = !meeting.waitingRoom || role !== "Attendee";

        const participant: Participant = {
          peerId: data.peerId,
          displayName: data.displayName,
          connectionId: socket.id,
          role,
          isAdmitted,
          joinedAt: new Date().toISOString(),
          json: data.profileJson || "{}",
          lastHeartbeat: Date.now(),
        };

        meeting.participants.set(data.peerId, participant);
        peerToMeeting.set(data.peerId, code);
        peerToParticipant.set(data.peerId, participant);

        socket.join(code);
        socket.join(`peer:${data.peerId}`);
        socket.data = { meetingCode: code, peerId: data.peerId, isHost };

        socket.emit("FullState", {
          meetingCode: code,
          eventName: meeting.eventName,
          hostPeerId: meeting.hostPeerId,
          waitingRoomEnabled: meeting.waitingRoom,
          participants: Object.fromEntries(meeting.participants),
          messages: meeting.messages,
        });

        if (!isAdmitted) {
          socket.emit("WaitingForAdmission", { meetingCode: code });
          io.to(code).emit("WaitingRoomUpdate", getWaitingPeers(meeting));
        } else {
          socket.to(code).emit("ParticipantJoined", participant);
        }

        if (role === "Host") {
          socket.emit("WaitingRoomUpdate", getWaitingPeers(meeting));
        }

        storage.scheduleSave(meetings);

        if (callback) callback({ status: "ok" });
      } catch (error: any) {
        logger.error({ error }, "Error joining meeting:");
        if (callback) callback({ code: "ERROR", detail: error.message });
      }
    });

    socket.on("claim_host", (
      rawData: unknown,
      callback?: (res?: any) => void,
    ) => {
      try {
        const parsed = ClaimHostSchema.safeParse(rawData);
        if (!parsed.success) {
          const errDetail = parsed.error.issues[0]?.message || "Invalid claim host payload";
          socket.emit("Error", { code: "BAD_REQUEST", detail: errDetail });
          if (callback) callback({ code: "BAD_REQUEST", detail: errDetail });
          return;
        }
        const data = parsed.data;
        const code = data.meetingCode.toUpperCase();
        const meeting = meetings.get(code);

        if (!meeting) {
          socket.emit("Error", { code: "NOT_FOUND", detail: "Meeting not found" });
          if (callback) callback({ code: "NOT_FOUND", detail: "Meeting not found" });
          return;
        }

        const isAuthorized = isAuthorizedHost(meeting, data.peerId, {
          hostSecret: data.hostSecret,
          proof: data.proof,
        });

        if (!isAuthorized) {
          socket.emit("Error", { code: "UNAUTHORIZED", detail: "Invalid host credentials" });
          if (callback) callback({ code: "UNAUTHORIZED", detail: "Invalid host credentials" });
          return;
        }

        const participant = meeting.participants.get(data.peerId);
        if (participant) {
          participant.role = "Host";
          participant.isAdmitted = true;
        }

        meeting.hostPeerId = data.peerId;
        socket.data = { ...socket.data, meetingCode: code, peerId: data.peerId, isHost: true };

        io.to(code).emit("RoleChanged", { peerId: data.peerId, role: "Host", newRole: "Host" });
        io.to(code).emit("HostChanged", { newHostPeerId: data.peerId });
        socket.emit("HostClaimed", { status: "ok", meetingCode: code });
        socket.emit("WaitingRoomUpdate", getWaitingPeers(meeting));

        storage.scheduleSave(meetings);

        if (callback) callback({ status: "ok" });
      } catch (err: any) {
        logger.error({ err }, "Error in claim_host");
        if (callback) callback({ code: "ERROR", detail: err?.message });
      }
    });

    socket.on("admit_participant", (
      rawData: unknown,
      callback?: (err?: any) => void,
    ) => {
      try {
        const parsed = AdmitParticipantSchema.safeParse(rawData);
        if (!parsed.success) {
          const errDetail = parsed.error.issues[0]?.message || "Invalid admit payload";
          socket.emit("Error", { code: "BAD_REQUEST", detail: errDetail });
          if (callback) callback({ code: "BAD_REQUEST", detail: errDetail });
          return;
        }
        const data = parsed.data;
        const code = data.meetingCode.toUpperCase();
        const meeting = meetings.get(code);

        if (!meeting) {
          if (callback) callback({ code: "NOT_FOUND", detail: "Meeting not found" });
          return;
        }

        // Authorization check: Only authenticated Host or Organizer can admit participants
        if (!isHostOrOrganizerCaller(socket, meeting)) {
          if (callback) callback({ code: "UNAUTHORIZED", detail: "Only host or organizer can admit participants" });
          return;
        }

        const participant = meeting.participants.get(data.peerId);
        if (!participant) {
          if (callback) callback({ code: "NOT_FOUND", detail: "Participant not found in meeting" });
          return;
        }

        participant.isAdmitted = true;

        const targetSocket = io.sockets.sockets.get(participant.connectionId);
        if (targetSocket) {
          targetSocket.emit("ParticipantAdmitted", { meetingCode: code, peerId: data.peerId });
          targetSocket.emit("FullState", {
            meetingCode: code,
            eventName: meeting.eventName,
            hostPeerId: meeting.hostPeerId,
            waitingRoomEnabled: meeting.waitingRoom,
            participants: Object.fromEntries(meeting.participants),
            messages: meeting.messages,
          });
        }

        io.to(code).emit("ParticipantJoined", participant);
        io.to(code).emit("WaitingRoomUpdate", getWaitingPeers(meeting));

        storage.scheduleSave(meetings);

        if (callback) callback();
      } catch (error: any) {
        logger.error({ error }, "Error admitting participant:");
        if (callback) callback({ code: "ERROR", detail: error.message });
      }
    });

    socket.on("kick_participant", (
      rawData: unknown,
      callback?: (err?: any) => void,
    ) => {
      try {
        const parsed = KickParticipantSchema.safeParse(rawData);
        if (!parsed.success) {
          const errDetail = parsed.error.issues[0]?.message || "Invalid kick payload";
          socket.emit("Error", { code: "BAD_REQUEST", detail: errDetail });
          if (callback) callback({ code: "BAD_REQUEST", detail: errDetail });
          return;
        }
        const data = parsed.data;
        const code = data.meetingCode.toUpperCase();
        const meeting = meetings.get(code);

        if (!meeting || !meeting.participants.has(data.peerId)) {
          if (callback) callback({ code: "NOT_FOUND", detail: "Participant not found" });
          return;
        }

        // Authorization check: Only authenticated Host or Organizer can kick
        if (!isHostOrOrganizerCaller(socket, meeting)) {
          if (callback) callback({ code: "UNAUTHORIZED", detail: "Only host or organizer can kick participants" });
          return;
        }

        // Prevent kicking the meeting host
        if (data.peerId === meeting.hostPeerId) {
          if (callback) callback({ code: "FORBIDDEN", detail: "Cannot kick the meeting host" });
          return;
        }

        if (!meeting.kickedPeers) meeting.kickedPeers = new Set();
        meeting.kickedPeers.add(data.peerId);

        const participant = meeting.participants.get(data.peerId);
        if (participant) {
          const targetSocket = io.sockets.sockets.get(participant.connectionId);
          if (targetSocket) {
            targetSocket.emit("Kicked", { meetingCode: code, reason: "You have been removed from this room by the host." });
            targetSocket.leave(code);
          }
          meeting.participants.delete(data.peerId);
          peerToMeeting.delete(data.peerId);
          peerToParticipant.delete(data.peerId);
          io.to(code).emit("ParticipantLeft", { peerId: data.peerId });
          io.to(code).emit("WaitingRoomUpdate", getWaitingPeers(meeting));
          scheduleExpiryIfEmpty(meeting, io);
          storage.scheduleSave(meetings);
        }

        if (callback) callback();
      } catch (error: any) {
        logger.error({ error }, "Error kicking participant:");
        if (callback) callback({ code: "ERROR", detail: error.message });
      }
    });

    socket.on("change_role", (
      rawData: unknown,
      callback?: (err?: any) => void,
    ) => {
      try {
        const parsed = ChangeRoleSchema.safeParse(rawData);
        if (!parsed.success) {
          const errDetail = parsed.error.issues[0]?.message || "Invalid change role payload";
          socket.emit("Error", { code: "BAD_REQUEST", detail: errDetail });
          if (callback) callback({ code: "BAD_REQUEST", detail: errDetail });
          return;
        }
        const data = parsed.data;
        const code = data.meetingCode.toUpperCase();
        const meeting = meetings.get(code);

        if (!meeting || !meeting.participants.has(data.peerId)) {
          if (callback) callback({ code: "NOT_FOUND", detail: "Participant not found" });
          return;
        }

        // Authorization check: Only the authenticated Host can change roles
        if (!isHostCaller(socket, meeting)) {
          if (callback) callback({ code: "UNAUTHORIZED", detail: "Only the host can change participant roles" });
          return;
        }

        const participant = meeting.participants.get(data.peerId);
        if (participant) {
          participant.role = data.newRole;
          io.to(code).emit("RoleChanged", { peerId: data.peerId, role: data.newRole, newRole: data.newRole });
          storage.scheduleSave(meetings);
        }

        if (callback) callback();
      } catch (error: any) {
        logger.error({ error }, "Error changing role:");
        if (callback) callback({ code: "ERROR", detail: error.message });
      }
    });

    socket.on("toggle_waiting_room", (
      rawData: unknown,
      callback?: (err?: any) => void,
    ) => {
      try {
        const parsed = ToggleWaitingRoomSchema.safeParse(rawData);
        if (!parsed.success) {
          const errDetail = parsed.error.issues[0]?.message || "Invalid toggle waiting room payload";
          socket.emit("Error", { code: "BAD_REQUEST", detail: errDetail });
          if (callback) callback({ code: "BAD_REQUEST", detail: errDetail });
          return;
        }
        const data = parsed.data;
        const code = data.meetingCode.toUpperCase();
        const meeting = meetings.get(code);

        if (!meeting) {
          if (callback) callback({ code: "NOT_FOUND", detail: "Meeting not found" });
          return;
        }

        // Authorization check: Only the authenticated Host can toggle waiting room
        if (!isHostCaller(socket, meeting)) {
          if (callback) callback({ code: "UNAUTHORIZED", detail: "Only the host can toggle the waiting room" });
          return;
        }

        meeting.waitingRoom = data.isEnabled;
        io.to(code).emit("WaitingRoomToggled", { meetingCode: code, isEnabled: data.isEnabled });
        io.to(code).emit("WaitingRoomUpdate", getWaitingPeers(meeting));
        storage.scheduleSave(meetings);

        if (callback) callback();
      } catch (error: any) {
        logger.error({ error }, "Error toggling waiting room:");
        if (callback) callback({ code: "ERROR", detail: error.message });
      }
    });

    socket.on("update_metadata", (rawData: unknown, callback?: () => void) => {
      const parsed = UpdateMetadataSchema.safeParse(rawData);
      if (!parsed.success) {
        if (callback) callback();
        return;
      }
      const data = parsed.data;
      const peerId = socket.data?.peerId;
      const code = data.meetingCode?.toUpperCase() ?? socket.data?.meetingCode;
      if (peerId && code) {
        const meeting = meetings.get(code);
        const participant = meeting?.participants.get(peerId);
        if (participant) {
          participant.json = data.json;
          io.to(code).emit("MetadataUpdated", { peerId, json: data.json });
          storage.scheduleSave(meetings);
        }
      }
      if (callback) callback();
    });

    socket.on("heartbeat", (rawData: unknown, callback?: () => void) => {
      const parsed = HeartbeatSchema.safeParse(rawData);
      const peerId = socket.data?.peerId;
      if (peerId && parsed.success) {
        const code = (parsed.data?.meetingCode ? parsed.data.meetingCode.toUpperCase() : null) || socket.data?.meetingCode;
        if (code) {
          const meeting = meetings.get(code);
          const participant = meeting?.participants.get(peerId);
          if (participant) participant.lastHeartbeat = Date.now();
        }
      }
      if (callback) callback();
    });

    socket.on("close_meeting", (
      rawData: unknown,
      callback?: (err?: any) => void,
    ) => {
      try {
        const parsed = CloseMeetingSchema.safeParse(rawData);
        if (!parsed.success) {
          const errDetail = parsed.error.issues[0]?.message || "Invalid close meeting payload";
          socket.emit("Error", { code: "BAD_REQUEST", detail: errDetail });
          if (callback) callback({ code: "BAD_REQUEST", detail: errDetail });
          return;
        }
        const data = parsed.data;
        const code = data.meetingCode.toUpperCase();
        const meeting = meetings.get(code);

        if (!meeting) {
          if (callback) callback({ code: "NOT_FOUND", detail: "Meeting not found" });
          return;
        }

        // Authorization check: Only the authenticated Host can close the meeting
        if (!isHostCaller(socket, meeting)) {
          if (callback) callback({ code: "UNAUTHORIZED", detail: "Only the host can close the meeting" });
          return;
        }

        io.to(code).emit("MeetingEnded");

        Array.from(io.sockets.sockets.values()).forEach((s: Socket) => {
          if (s.rooms.has(code)) s.leave(code);
        });

        clearTimeout(meeting.expiryTimer);
        meeting.participants.forEach((participant) => {
          peerToMeeting.delete(participant.peerId);
          peerToParticipant.delete(participant.peerId);
        });
        meetings.delete(code);
        storage.scheduleSave(meetings);

        if (callback) callback();
      } catch (error: any) {
        logger.error({ error }, "Error closing meeting:");
        if (callback) callback({ code: "ERROR", detail: error.message });
      }
    });

    socket.on("send_reaction", (rawData: unknown, callback?: () => void) => {
      if (!reactionRateLimiter.allow(socket.id)) {
        if (callback) callback();
        return;
      }
      const parsed = SendReactionSchema.safeParse(rawData);
      if (!parsed.success) {
        if (callback) callback();
        return;
      }
      const data = parsed.data;
      const peerId = socket.data?.peerId;
      const meetingCode = (data.meetingCode || socket.data?.meetingCode)?.toUpperCase();
      if (!peerId || !meetingCode || !data.emoji) {
        if (callback) callback();
        return;
      }

      const meeting = meetings.get(meetingCode);
      const participant = meeting?.participants.get(peerId);
      if (!participant) {
        if (callback) callback();
        return;
      }

      participant.lastHeartbeat = Date.now();

      let avatarUrl: string | undefined;
      try {
        const profile = JSON.parse(participant.json || "{}");
        if (profile.photo) avatarUrl = profile.photo;
      } catch {}

      io.to(meetingCode).emit("ReactionReceived", {
        peerId,
        displayName: participant.displayName,
        emoji: data.emoji,
        avatarUrl,
      });

      if (callback) callback();
    });

    socket.on("send_chat_message", (
      rawData: unknown,
      callback?: (res?: any) => void,
    ) => {
      try {
        if (!chatRateLimiter.allow(socket.id)) {
          socket.emit("Error", { code: "RATE_LIMITED", detail: "Slow down! Chat messages are rate limited." });
          if (callback) callback({ code: "RATE_LIMITED", detail: "Rate limited" });
          return;
        }
        const parsed = SendChatMessageSchema.safeParse(rawData);
        if (!parsed.success) {
          const errDetail = parsed.error.issues[0]?.message || "Invalid chat message";
          socket.emit("Error", { code: "BAD_REQUEST", detail: errDetail });
          if (callback) callback({ code: "BAD_REQUEST", detail: errDetail });
          return;
        }
        const data = parsed.data;
        const peerId = socket.data?.peerId;
        const meetingCode = (data.meetingCode || socket.data?.meetingCode)?.toUpperCase();
        if (!peerId || !meetingCode) {
          if (callback) callback({ code: "BAD_REQUEST", detail: "Missing peerId or meetingCode" });
          return;
        }

        const meeting = meetings.get(meetingCode);
        if (!meeting) {
          if (callback) callback({ code: "NOT_FOUND", detail: "Meeting not found" });
          return;
        }

        const participant = meeting.participants.get(peerId);
        if (!participant) {
          if (callback) callback({ code: "NOT_FOUND", detail: "Participant not found in meeting" });
          return;
        }

        participant.lastHeartbeat = Date.now();

        let avatarUrl: string | undefined;
        try {
          const profile = JSON.parse(participant.json || "{}");
          if (profile.photo) avatarUrl = profile.photo;
        } catch {}

        const chatMessage: ChatMessage = {
          id: `${Date.now()}-${uuidv4().slice(0, 8)}`,
          meetingCode,
          peerId,
          displayName: participant.displayName,
          text: data.text,
          timestamp: new Date().toISOString(),
          avatarUrl,
        };

        meeting.messages.push(chatMessage);
        if (meeting.messages.length > 100) {
          meeting.messages.shift();
        }
        storage.scheduleSave(meetings);

        io.to(meetingCode).emit("ChatMessageReceived", chatMessage);
        if (callback) callback({ status: "ok", message: chatMessage });
      } catch (err: any) {
        logger.error({ err }, "Error in send_chat_message");
        if (callback) callback({ code: "ERROR", detail: err?.message });
      }
    });

    socket.on("send_direct_message", (
      rawData: unknown,
      callback?: (res?: any) => void,
    ) => {
      try {
        if (!dmRateLimiter.allow(socket.id)) {
          socket.emit("Error", { code: "RATE_LIMITED", detail: "Slow down! Direct messages are rate limited." });
          if (callback) callback({ code: "RATE_LIMITED", detail: "Rate limited" });
          return;
        }
        const parsed = SendDirectMessageSchema.safeParse(rawData);
        if (!parsed.success) {
          const errDetail = parsed.error.issues[0]?.message || "Invalid direct message";
          socket.emit("Error", { code: "BAD_REQUEST", detail: errDetail });
          if (callback) callback({ code: "BAD_REQUEST", detail: errDetail });
          return;
        }
        const data = parsed.data;
        const peerId = socket.data?.peerId;
        const meetingCode = (data.meetingCode || socket.data?.meetingCode)?.toUpperCase();
        if (!peerId || !meetingCode) {
          if (callback) callback({ code: "BAD_REQUEST", detail: "Missing required fields" });
          return;
        }

        const meeting = meetings.get(meetingCode);
        if (!meeting) {
          if (callback) callback({ code: "NOT_FOUND", detail: "Meeting not found" });
          return;
        }

        const sender = meeting.participants.get(peerId);
        const recipient = meeting.participants.get(data.toPeerId);

        if (!sender || !recipient) {
          if (callback) callback({ code: "NOT_FOUND", detail: "Sender or recipient not in meeting" });
          return;
        }

        sender.lastHeartbeat = Date.now();

        let avatarUrl: string | undefined;
        try {
          const profile = JSON.parse(sender.json || "{}");
          if (profile.photo) avatarUrl = profile.photo;
        } catch {}

        const chatMessage: ChatMessage = {
          id: `${Date.now()}-${uuidv4().slice(0, 8)}`,
          meetingCode,
          peerId,
          displayName: sender.displayName,
          text: data.text,
          timestamp: new Date().toISOString(),
          avatarUrl,
          toPeerId: data.toPeerId,
        };

        // Dispatch to recipient and echo back to sender
        io.to(`peer:${data.toPeerId}`).emit("DirectMessageReceived", chatMessage);
        if (data.toPeerId !== peerId) {
          socket.emit("DirectMessageReceived", chatMessage);
        }

        if (callback) callback({ status: "ok", message: chatMessage });
      } catch (err: any) {
        logger.error({ err }, "Error in send_direct_message");
        if (callback) callback({ code: "ERROR", detail: err?.message });
      }
    });

    socket.on("send_announcement", (
      rawData: unknown,
      callback?: (res?: any) => void,
    ) => {
      try {
        if (!announcementRateLimiter.allow(socket.id)) {
          socket.emit("Error", { code: "RATE_LIMITED", detail: "Announcements are rate limited. Please wait." });
          if (callback) callback({ code: "RATE_LIMITED", detail: "Rate limited" });
          return;
        }
        const parsed = SendAnnouncementSchema.safeParse(rawData);
        if (!parsed.success) {
          const errDetail = parsed.error.issues[0]?.message || "Invalid announcement payload";
          socket.emit("Error", { code: "BAD_REQUEST", detail: errDetail });
          if (callback) callback({ code: "BAD_REQUEST", detail: errDetail });
          return;
        }
        const data = parsed.data;
        const meetingCode = (data.meetingCode || socket.data?.meetingCode)?.toUpperCase();
        if (!meetingCode) {
          if (callback) callback({ code: "BAD_REQUEST", detail: "Missing meetingCode" });
          return;
        }

        const meeting = meetings.get(meetingCode);
        if (!meeting) {
          if (callback) callback({ code: "NOT_FOUND", detail: "Meeting not found" });
          return;
        }

        // Authorization check: Only authenticated Host can broadcast announcements
        if (!isHostCaller(socket, meeting)) {
          if (callback) callback({ code: "UNAUTHORIZED", detail: "Only the host can broadcast announcements" });
          return;
        }

        const payload = {
          id: uuidv4(),
          message: data.message,
          timestamp: new Date().toISOString(),
          hostName: data.hostName || "Host",
        };

        io.to(meetingCode).emit("AnnouncementReceived", payload);
        if (callback) callback({ status: "ok", announcement: payload });
      } catch (err: any) {
        logger.error({ err }, "Error in send_announcement");
        if (callback) callback({ code: "ERROR", detail: err?.message });
      }
    });

    socket.on("disconnect", () => {
      logger.info({ socketId: socket.id }, "Client disconnected");

      const meetingCode = socket.data?.meetingCode;
      const peerId = socket.data?.peerId;

      if (meetingCode && peerId) {
        const meeting = meetings.get(meetingCode);
        if (meeting) {
          // ── The Host CANNOT leave at all on disconnect ─────────────────
          if (peerId === meeting.hostPeerId) {
            logger.info({ peerId, meetingCode }, "Host disconnected socket — keeping host node permanently in room");
            return;
          }

          const participant = meeting.participants.get(peerId);
          if (participant && participant.connectionId === socket.id) {
            const timerKey = `${meetingCode}:${peerId}`;
            const existingTimer = disconnectTimers.get(timerKey);
            if (existingTimer) clearTimeout(existingTimer);

            // 5-minute buffer before removing attendee from the room
            const timer = setTimeout(() => {
              disconnectTimers.delete(timerKey);
              const current = meeting.participants.get(peerId);
              if (current && current.connectionId === socket.id) {
                meeting.participants.delete(peerId);
                peerToMeeting.delete(peerId);
                peerToParticipant.delete(peerId);
                io.to(meetingCode).emit("ParticipantLeft", { peerId });
                io.to(meetingCode).emit("WaitingRoomUpdate", getWaitingPeers(meeting));
                scheduleExpiryIfEmpty(meeting, io);
                storage.scheduleSave(meetings);
                logger.info({ peerId, meetingCode }, "5-minute disconnect buffer expired — removed attendee");
              }
            }, DISCONNECT_BUFFER_MS);

            disconnectTimers.set(timerKey, timer);
          }
        }
      }
    });
  });

  // Clean up interval on server close
  server.on("close", () => clearInterval(heartbeatInterval));
}

// ── Health endpoint data helper ───────────────────────────────────────────
export function getStats() {
  let totalParticipants = 0;
  for (const m of meetings.values()) totalParticipants += m.participants.size;
  return { meetings: meetings.size, participants: totalParticipants };
}

const router: IRouter = Router();
export default router;
