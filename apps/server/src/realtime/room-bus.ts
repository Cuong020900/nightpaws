import { randomBytes } from "node:crypto";
import type { CharacterAppearance, PlayerDelta, RoomMusicState, RoomPlayer } from "@nightpaws/shared";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";

export type BusEvent =
  | { k: "join"; player: RoomPlayer }
  | { k: "leave"; id: string }
  | { k: "look"; id: string; name: string; look: CharacterAppearance }
  | { k: "tick"; p: PlayerDelta[] }
  | { k: "roster"; players: RoomPlayer[] }
  | { k: "music"; state: RoomMusicState }
  | { k: "queue" };

interface BusEnvelope {
  o: string;
  r: string;
  e: BusEvent;
}

export type BusHandler = (roomId: string, origin: string, event: BusEvent) => void;

const channelPrefix = "np:bus:";

export class RoomBus {
  readonly instanceId = randomBytes(6).toString("hex");
  private handler: BusHandler | null = null;

  constructor(
    private readonly publisher: Redis,
    private readonly subscriber: Redis,
    private readonly log: FastifyBaseLogger,
  ) {
    this.subscriber.on("message", (channel: string, payload: string) => this.receive(channel, payload));
  }

  async subscribe(roomIds: string[], handler: BusHandler): Promise<void> {
    this.handler = handler;
    await this.subscriber.subscribe(...roomIds.map((roomId) => channelPrefix + roomId));
  }

  publish(roomId: string, event: BusEvent): void {
    const envelope: BusEnvelope = { o: this.instanceId, r: roomId, e: event };
    this.publisher.publish(channelPrefix + roomId, JSON.stringify(envelope)).catch((error: unknown) => {
      this.log.warn({ err: error, roomId, kind: event.k }, "room bus publish failed");
    });
  }

  private receive(channel: string, payload: string): void {
    if (!channel.startsWith(channelPrefix)) return;
    let envelope: BusEnvelope;
    try {
      envelope = JSON.parse(payload) as BusEnvelope;
    } catch {
      return;
    }
    if (envelope.o === this.instanceId || envelope.r !== channel.slice(channelPrefix.length)) return;
    this.handler?.(envelope.r, envelope.o, envelope.e);
  }
}
