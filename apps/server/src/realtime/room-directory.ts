import { sceneDescriptors, type RoomSummary } from "@nightpaws/shared";
import type { FastifyBaseLogger } from "fastify";
import type { Redis } from "ioredis";
import type { MusicService } from "../music/music-service.ts";
import type { RoomBus } from "./room-bus.ts";
import { RoomHub, type RoomHubSettings } from "./room-hub.ts";
import { RoomMembership, type MembershipSettings } from "./room-membership.ts";

export class RoomDirectory {
  private readonly hubs = new Map<string, RoomHub>();

  constructor(
    redis: Redis,
    private readonly bus: RoomBus,
    music: MusicService,
    settings: MembershipSettings & RoomHubSettings,
    log: FastifyBaseLogger,
  ) {
    for (const descriptor of sceneDescriptors) {
      const membership = new RoomMembership(redis, descriptor.id, settings);
      const hub = new RoomHub(descriptor, membership, bus, descriptor.hasMusic ? music : null, settings, log.child({ room: descriptor.id }));
      this.hubs.set(descriptor.id, hub);
    }
    music.onChange((state) => this.hubs.get(state.roomId)?.publishMusic(state));
  }

  get(roomId: string): RoomHub | undefined {
    return this.hubs.get(roomId);
  }

  get summaries(): RoomSummary[] {
    return [...this.hubs.values()].map((hub) => hub.summary);
  }

  async start(): Promise<void> {
    await this.bus.subscribe([...this.hubs.keys()], (roomId, origin, event) => this.hubs.get(roomId)?.receive(origin, event));
    for (const hub of this.hubs.values()) hub.start();
  }

  async stop(): Promise<void> {
    for (const hub of this.hubs.values()) hub.stop();
    await Promise.all([...this.hubs.values()].map((hub) => hub.drain()));
  }
}
