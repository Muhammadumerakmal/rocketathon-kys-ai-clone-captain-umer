import { describe, expect, it } from "vitest";
import { FAR, idleRadius, NEAR, ORB_R, orbLabel, ringCenters, targetDistance, thinkingOffset } from "@/components/twin-orb/geometry";

describe("twin orb geometry (plan §5)", () => {
  it("maps readiness 0..1 to distance 46 → 16", () => {
    expect(targetDistance(0)).toBe(FAR);
    expect(targetDistance(1)).toBe(NEAR);
    expect(targetDistance(0.5)).toBe(31);
  });

  it("clamps readiness and pulls 8 closer while listening", () => {
    expect(targetDistance(-3)).toBe(FAR);
    expect(targetDistance(7)).toBe(NEAR);
    expect(targetDistance(0, true)).toBe(FAR - 8);
  });

  it("keeps ring centres symmetric around x=50", () => {
    const { ax, bx } = ringCenters(30);
    expect((ax + bx) / 2).toBe(50);
    expect(bx - ax).toBe(30);
  });

  it("breathes within ±0.7 of r=24 and orbits on a small ellipse", () => {
    for (const t of [0, 400, 1234, 9999]) {
      expect(Math.abs(idleRadius(t) - ORB_R)).toBeLessThanOrEqual(0.7 + 1e-9);
      const o = thinkingOffset(t);
      expect(Math.abs(o.dx)).toBeLessThanOrEqual(3);
      expect(Math.abs(o.dy)).toBeLessThanOrEqual(2.2);
    }
  });

  it("describes itself for screen readers", () => {
    expect(orbLabel(0.5)).toBe("Your twin: 50% of the way to knowing how you decide");
  });
});
