import { MeshClient, type MachineState, type ConnectionStatus, type ChatMessage } from 'sixhuma-core';
import { MockMeshClient } from '../mock/MockMeshClient';
import { chatStore } from './chatStore.svelte';
import { reactionStore } from './reactionStore.svelte';
import { soundService } from '../utils/soundService';

const IS_MOCK = typeof import.meta !== 'undefined' && import.meta.env?.VITE_MOCK_MODE === 'true';

function getHubUrl(): string {
  if (typeof import.meta !== 'undefined' && import.meta.env?.VITE_HUB_URL) {
    return String(import.meta.env.VITE_HUB_URL);
  }
  if (typeof window !== 'undefined') {
    if (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') {
      return 'http://localhost:3000';
    }
    if (window.location.hostname.endsWith('github.io')) {
      return 'https://sixhuma-api.onrender.com';
    }
    return window.location.origin;
  }
  return 'http://localhost:3000';
}
const HUB_URL = getHubUrl();

export class MeshClientStore {
  client: MeshClient;
  state = $state<MachineState>({
    phase: 'idle',
    room: null,
    waitingRoom: [],
    selfPeerId: null,
    latencyMs: 0,
    hostSecret: null,
  });
  connectionStatus = $state<ConnectionStatus>('disconnected');

  constructor() {
    this.client = (IS_MOCK
      ? (new MockMeshClient() as unknown as MeshClient)
      : new MeshClient(HUB_URL)) as MeshClient;

    // Sync initial state
    this.state = this.client.state;
    this.connectionStatus = this.client.connectionStatus;

    // Subscribe to state machine updates
    this.client.subscribeToState((s) => {
      this.state = { ...s };
    });

    this.client.on('ConnectionStatusChanged', (status) => {
      this.connectionStatus = status;
    });

    this.client.on('ChatMessageReceived', (msg: ChatMessage) => {
      chatStore.handleIncomingGlobal(msg, this.state.selfPeerId);
    });

    this.client.on('DirectMessageReceived', (msg: ChatMessage) => {
      const currentSelf =
        this.state.selfPeerId ||
        (typeof sessionStorage !== 'undefined' ? sessionStorage.getItem('meetmesh_peer_id') : null) ||
        (typeof localStorage !== 'undefined' ? localStorage.getItem('meetmesh_peer_id') : null);
      chatStore.handleIncomingDm(msg, currentSelf);
      if (currentSelf && msg.peerId !== currentSelf) {
        soundService.playDm();
      }
    });

    this.client.on('ParticipantJoined', () => {
      soundService.playJoin();
    });

    this.client.on('ReactionReceived', (payload) => {
      soundService.playReaction();
      if (payload.peerId !== this.state.selfPeerId) {
        reactionStore.fire({
          peerId: payload.peerId,
          displayName: payload.displayName,
          emoji: payload.emoji,
          avatarUrl: payload.avatarUrl,
        });
      }
    });

    this.client.on('AnnouncementReceived', () => {
      soundService.playAnnouncement();
    });

    this.client.on('ChatHistoryReceived', (messages: ChatMessage[]) => {
      chatStore.seedGlobal(messages);
    });
  }

  async connect(): Promise<void> {
    return this.client.connect();
  }

  async disconnect(): Promise<void> {
    return this.client.disconnect();
  }

  setHostSecret(secret: string): void {
    if (this.state.hostSecret === secret) return;
    return this.client.setHostSecret(secret);
  }

  async createMeeting(eventName: string, peerId: string, profileJson = '{}', subtitle?: string, description?: string): Promise<void> {
    return this.client.createMeeting(eventName, peerId, profileJson, subtitle, description);
  }

  async joinMeeting(meetingCode: string, displayName: string, peerId: string, profileJson = '{}', hostSecret?: string): Promise<void> {
    return this.client.joinMeeting(meetingCode, displayName, peerId, profileJson, hostSecret);
  }

  async admitParticipant(meetingCode: string, peerId: string): Promise<void> {
    return this.client.admitParticipant(meetingCode, peerId);
  }

  async kickParticipant(meetingCode: string, peerId: string): Promise<void> {
    return this.client.kickParticipant(meetingCode, peerId);
  }

  async changeRole(meetingCode: string, peerId: string, newRole: string): Promise<void> {
    return this.client.changeRole(meetingCode, peerId, newRole);
  }

  async toggleWaitingRoom(meetingCode: string, isEnabled: boolean): Promise<void> {
    return this.client.toggleWaitingRoom(meetingCode, isEnabled);
  }

  async updateMetadata(meetingCode: string, json: string): Promise<void> {
    return this.client.updateMetadata(meetingCode, json);
  }

  async closeMeeting(meetingCode: string): Promise<void> {
    return this.client.closeMeeting(meetingCode);
  }

  async claimHost(meetingCode: string, peerId: string, secret?: string): Promise<void> {
    return this.client.claimHost(meetingCode, peerId, secret);
  }

  async heartbeat(meetingCode: string): Promise<void> {
    return this.client.heartbeat(meetingCode);
  }

  async sendReaction(meetingCode: string, emoji: string): Promise<void> {
    return this.client.sendReaction(meetingCode, emoji);
  }

  async sendChatMessage(meetingCode: string, text: string): Promise<void> {
    return this.client.sendChatMessage(meetingCode, text);
  }

  async sendDirectMessage(meetingCode: string, toPeerId: string, text: string): Promise<void> {
    return this.client.sendDirectMessage(meetingCode, toPeerId, text);
  }

  async sendAnnouncement(meetingCode: string, message: string, hostName?: string): Promise<void> {
    return this.client.sendAnnouncement(meetingCode, message, hostName);
  }

  on(event: any, handler: any): void {
    this.client.on(event, handler);
  }

  off(event: any, handler: any): void {
    this.client.off(event, handler);
  }
}

export const meshClient = new MeshClientStore();
