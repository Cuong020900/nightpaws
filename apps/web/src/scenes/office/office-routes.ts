import * as THREE from "three";
import type { DeskSeat } from "./office-architecture.ts";

export interface Spot {
  node: number;
  facing: number;
}

export interface ChatCluster {
  center: THREE.Vector3;
  spots: Spot[];
}

export interface OfficeMap {
  routes: OfficeRoutes;
  seats: Spot[];
  drinkSpots: (Spot & { coffee: boolean })[];
  clusters: ChatCluster[];
  danceSpots: Spot[];
}

const lanes = [-10.2, -5.5, -0.9, 3.3];
const columns = [7.9, 13.1];
const seatInset = 0.18;

export class OfficeRoutes {
  private readonly points: THREE.Vector3[] = [];
  private readonly links: number[][] = [];

  add(x: number, z: number): number {
    this.points.push(new THREE.Vector3(x, 0, z));
    this.links.push([]);
    return this.points.length - 1;
  }

  link(a: number, b: number): void {
    if (a === b || this.links[a]!.includes(b)) return;
    this.links[a]!.push(b);
    this.links[b]!.push(a);
  }

  linkNearest(node: number, candidates: number[]): void {
    const at = this.points[node]!;
    const nearest = candidates.reduce((best, candidate) => (this.points[candidate]!.distanceToSquared(at) < this.points[best]!.distanceToSquared(at) ? candidate : best));
    this.link(node, nearest);
  }

  point(node: number): THREE.Vector3 {
    return this.points[node]!;
  }

  route(from: number, to: number): THREE.Vector3[] {
    const count = this.points.length;
    const cost = new Array<number>(count).fill(Infinity);
    const previous = new Array<number>(count).fill(-1);
    const done = new Array<boolean>(count).fill(false);
    cost[from] = 0;
    for (let step = 0; step < count; step += 1) {
      let current = -1;
      for (let i = 0; i < count; i += 1) if (!done[i] && (current < 0 || cost[i]! < cost[current]!)) current = i;
      if (current < 0 || cost[current] === Infinity || current === to) break;
      done[current] = true;
      for (const next of this.links[current]!) {
        const total = cost[current]! + this.points[current]!.distanceTo(this.points[next]!);
        if (total < cost[next]!) {
          cost[next] = total;
          previous[next] = current;
        }
      }
    }
    const path: THREE.Vector3[] = [];
    for (let node = to; node !== -1 && node !== from; node = previous[node]!) path.unshift(this.points[node]!);
    return path;
  }
}

export function buildOfficeMap(deskSeats: DeskSeat[]): OfficeMap {
  const routes = new OfficeRoutes();
  const grid = new Map<string, number>();
  for (const side of [-1, 1]) for (const x of columns) for (const z of lanes) grid.set(`${side}:${x}:${z}`, routes.add(side * x, z));
  const gridNode = (side: number, x: number, z: number) => grid.get(`${side}:${x}:${z}`)!;
  for (const side of [-1, 1])
    for (const x of columns)
      for (let lane = 1; lane < lanes.length; lane += 1) routes.link(gridNode(side, x, lanes[lane - 1]!), gridNode(side, x, lanes[lane]!));

  const laneStops = new Map<string, { x: number; node: number }[]>();
  const seats = deskSeats.map((seat): Spot => {
    const side = Math.sign(seat.x);
    const forward = Math.cos(seat.facing);
    const lane = lanes.reduce((best, z) => (Math.abs(z - seat.z) < Math.abs(best - seat.z) && Math.sign(z - seat.z) === -forward ? z : best), seat.z - forward * 99);
    const approach = routes.add(seat.x, lane);
    const sit = routes.add(seat.x, seat.z + forward * seatInset);
    routes.link(approach, sit);
    const key = `${side}:${lane}`;
    laneStops.set(key, [...(laneStops.get(key) ?? []), { x: Math.abs(seat.x), node: approach }]);
    return { node: sit, facing: seat.facing };
  });
  for (const side of [-1, 1]) {
    for (const z of lanes) {
      const stops = [{ x: columns[0]!, node: gridNode(side, columns[0]!, z) }, ...(laneStops.get(`${side}:${z}`) ?? []), { x: columns[1]!, node: gridNode(side, columns[1]!, z) }];
      stops.sort((a, b) => a.x - b.x);
      for (let i = 1; i < stops.length; i += 1) routes.link(stops[i - 1]!.node, stops[i]!.node);
    }
  }
  const laneC = (side: number) => [...(laneStops.get(`${side}:${lanes[3]}`) ?? []).map((stop) => stop.node), gridNode(side, columns[0]!, lanes[3]!), gridNode(side, columns[1]!, lanes[3]!)];

  const hubs = [-1, 1].map((side) => {
    const hub = routes.add(side * 5, 3.7);
    routes.link(hub, gridNode(side, columns[0]!, lanes[3]!));
    return hub;
  });
  routes.link(hubs[0]!, hubs[1]!);

  const pantryOuter = gridNode(-1, columns[1]!, lanes[3]!);
  const drinkSpots = [
    { x: -13.72, z: 2.2, coffee: false },
    { x: -13.72, z: 4.0, coffee: true },
  ].map(({ x, z, coffee }) => {
    const node = routes.add(x, z);
    routes.link(node, pantryOuter);
    return { node, facing: -Math.PI / 2, coffee };
  });
  routes.link(drinkSpots[0]!.node, gridNode(-1, columns[1]!, lanes[2]!));

  const cluster = (cx: number, cz: number, angles: number[], radius: number, link: number[]): ChatCluster => {
    const center = new THREE.Vector3(cx, 0, cz);
    const spots = angles.map((angle): Spot => {
      const node = routes.add(cx + Math.sin(angle) * radius, cz + Math.cos(angle) * radius);
      routes.linkNearest(node, link);
      return { node, facing: angle + Math.PI };
    });
    return { center, spots };
  };
  const third = (Math.PI * 2) / 3;
  const clusters = [
    cluster(-11.3, 4.5, [-0.5, -0.5 + third, -0.5 + 2 * third], 0.78, laneC(-1)),
    cluster(5.2, 6.0, [0.3, 0.3 + third, 0.3 + 2 * third], 0.9, [hubs[1]!]),
    cluster(-4.9, 6.3, [Math.PI / 2 + 0.4, -Math.PI / 2 + 0.4], 0.72, [hubs[0]!]),
    cluster(10.9, 3.95, [Math.PI / 2, -Math.PI / 2], 0.72, laneC(1)),
  ];

  const floorLinks = [...hubs, gridNode(-1, columns[0]!, lanes[1]!), gridNode(1, columns[0]!, lanes[1]!)];
  const danceSpots = (
    [
      [-4.3, 1.2],
      [4.2, 0.9],
      [-1.6, 1.6],
      [2.0, -0.4],
      [-4.6, -4.4],
      [4.5, -4.8],
      [-3.2, -7.0],
      [3.4, -7.2],
      [-0.2, -2.6],
    ] as const
  ).map(([x, z]): Spot => {
    const node = routes.add(x, z);
    routes.linkNearest(node, floorLinks);
    return { node, facing: Math.atan2(-x, -10.5 - z) };
  });

  return { routes, seats, drinkSpots, clusters, danceSpots };
}
