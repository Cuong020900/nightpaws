export class TokenBucket {
  private tokens: number;
  private updatedAt: number;

  constructor(
    private readonly ratePerSecond: number,
    private readonly burst: number,
    now = performance.now(),
  ) {
    this.tokens = burst;
    this.updatedAt = now;
  }

  take(cost = 1, now = performance.now()): boolean {
    this.tokens = Math.min(this.burst, this.tokens + ((now - this.updatedAt) / 1000) * this.ratePerSecond);
    this.updatedAt = now;
    if (this.tokens < cost) return false;
    this.tokens -= cost;
    return true;
  }
}

export class DecayingCounter {
  private value = 0;
  private updatedAt: number;

  constructor(
    private readonly halfLifeMs: number,
    now = performance.now(),
  ) {
    this.updatedAt = now;
  }

  add(amount: number, now = performance.now()): number {
    this.value = this.value * Math.pow(0.5, (now - this.updatedAt) / this.halfLifeMs) + amount;
    this.updatedAt = now;
    return this.value;
  }
}
