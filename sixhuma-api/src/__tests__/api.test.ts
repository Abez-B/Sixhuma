import { describe, it, expect, beforeAll, afterAll } from "vitest";
import { createServer } from "http";
import { io as Client, type Socket as ClientSocket } from "socket.io-client";
import express from "express";
import crypto from "node:crypto";
import { setupSocketIO } from "../routes/meetings";

describe("Meetmesh API Integration Tests", () => {
  let httpServer: ReturnType<typeof createServer>;
  let port: number;
  let serverUrl: string;

  beforeAll(async () => {
    const app = express();
    app.get("/api/health", (_req, res) => {
      res.json({ status: "ok" });
    });

    httpServer = createServer(app);
    setupSocketIO(httpServer);

    await new Promise<void>((resolve) => {
      httpServer.listen(0, () => {
        const addr = httpServer.address();
        if (typeof addr === "object" && addr !== null) {
          port = addr.port;
          serverUrl = `http://localhost:${port}`;
        }
        resolve();
      });
    });
  });

  afterAll(async () => {
    await new Promise<void>((resolve) => {
      httpServer.close(() => resolve());
    });
  });

  it("responds to /api/health endpoint", async () => {
    const res = await fetch(`${serverUrl}/api/health`);
    const data = (await res.json()) as { status: string };
    expect(res.status).toBe(200);
    expect(data.status).toBe("ok");
  });

  it("handles meeting creation and host secret generation", async () => {
    const client: ClientSocket = Client(serverUrl);

    await new Promise<void>((resolve) => client.on("connect", resolve));

    let createdCode = "";
    let createdSecret = "";

    await new Promise<void>((resolve) => {
      client.on("MeetingCreated", (data: { meetingCode: string; hostSecret: string }) => {
        createdCode = data.meetingCode;
        createdSecret = data.hostSecret;
        resolve();
      });

      client.emit("create_meeting", {
        eventName: "Vitest Demo",
        peerId: "host-1",
        profileJson: JSON.stringify({ name: "Host One" }),
      });
    });

    expect(createdCode).toHaveLength(4);
    expect(createdSecret).toBeTruthy();

    client.disconnect();
  });

  it("prevents unauthenticated attendee from taking Host role and allows claimHost with HMAC proof", async () => {
    const hostClient: ClientSocket = Client(serverUrl);
    await new Promise<void>((resolve) => hostClient.on("connect", resolve));

    let meetingCode = "";
    let hostSecret = "";

    await new Promise<void>((resolve) => {
      hostClient.on("MeetingCreated", (data: { meetingCode: string; hostSecret: string }) => {
        meetingCode = data.meetingCode;
        hostSecret = data.hostSecret;
        resolve();
      });

      hostClient.emit("create_meeting", {
        eventName: "Security Test Event",
        peerId: "real-host",
        profileJson: JSON.stringify({ name: "Real Host" }),
      });
    });

    // Attendee joins without secret using host's peerId (impersonation attempt)
    const impostorClient: ClientSocket = Client(serverUrl);
    await new Promise<void>((resolve) => impostorClient.on("connect", resolve));

    await new Promise<void>((resolve) => {
      impostorClient.on("FullState", (data: any) => {
        // Impostor joined, but their role must be Attendee because they lacked the secret
        const impostor = data.participants["real-host"];
        expect(impostor.role).toBe("Attendee");
        resolve();
      });

      impostorClient.emit("join_meeting", {
        meetingCode,
        displayName: "Impostor",
        peerId: "real-host",
      });
    });

    // Valid claimHost using HMAC SHA-256 proof
    const legitDelegate: ClientSocket = Client(serverUrl);
    await new Promise<void>((resolve) => legitDelegate.on("connect", resolve));

    const proof = crypto
      .createHmac("sha256", hostSecret)
      .update(`${meetingCode.toUpperCase()}:delegate-peer`)
      .digest("base64");

    await new Promise<void>((resolve) => {
      legitDelegate.emit(
        "join_meeting",
        {
          meetingCode,
          displayName: "Delegate",
          peerId: "delegate-peer",
        },
        () => resolve()
      );
    });

    let claimed = false;
    await new Promise<void>((resolve) => {
      legitDelegate.on("HostClaimed", () => {
        claimed = true;
        resolve();
      });

      legitDelegate.emit("claim_host", {
        meetingCode,
        peerId: "delegate-peer",
        proof,
      });
    });

    expect(claimed).toBe(true);

    hostClient.disconnect();
    impostorClient.disconnect();
    legitDelegate.disconnect();
  });
});
