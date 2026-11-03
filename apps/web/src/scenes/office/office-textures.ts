import * as THREE from "three";
import { canvasTexture, pawPath, rnd, TAU } from "../common/club-kit.ts";

export function carpetTexture(): THREE.CanvasTexture {
  return canvasTexture(
    512,
    512,
    (g, w, h) => {
      const tile = w / 4;
      for (let i = 0; i < 4; i += 1) {
        for (let j = 0; j < 4; j += 1) {
          const shade = 62 + ((i + j) % 2) * 7;
          g.fillStyle = `rgb(${shade},${shade + 6},${shade + 24})`;
          g.fillRect(i * tile, j * tile, tile, tile);
          g.strokeStyle = "rgba(255,255,255,0.025)";
          g.lineWidth = 2;
          for (let k = 4; k < tile; k += 6) {
            g.beginPath();
            if ((i + j) % 2) {
              g.moveTo(i * tile + k, j * tile);
              g.lineTo(i * tile + k, (j + 1) * tile);
            } else {
              g.moveTo(i * tile, j * tile + k);
              g.lineTo((i + 1) * tile, j * tile + k);
            }
            g.stroke();
          }
        }
      }
      for (let n = 0; n < 9000; n += 1) {
        const v = (44 + rnd() * 50) | 0;
        g.fillStyle = `rgba(${v},${v + 8},${v + 30},0.35)`;
        g.fillRect(rnd() * w, rnd() * h, 2, 2);
      }
      g.strokeStyle = "rgba(0,0,0,0.35)";
      g.lineWidth = 2;
      for (let x = 0; x <= w; x += tile) {
        g.beginPath();
        g.moveTo(x, 0);
        g.lineTo(x, h);
        g.stroke();
        g.beginPath();
        g.moveTo(0, x);
        g.lineTo(w, x);
        g.stroke();
      }
    },
    [15, 12],
  );
}

export function woodFloorTexture(): THREE.CanvasTexture {
  return canvasTexture(
    512,
    512,
    (g, w, h) => {
      const plank = w / 8;
      g.fillStyle = "rgb(124,89,57)";
      g.fillRect(0, 0, w, h);
      for (let i = 0; i < 8; i += 1) {
        const offset = rnd() * h;
        for (let piece = -2; piece < 2; piece += 1) {
          const y = offset + piece * h * 0.62;
          const tone = 112 + rnd() * 34;
          g.fillStyle = `rgb(${tone | 0},${(tone * 0.72) | 0},${(tone * 0.46) | 0})`;
          g.fillRect(i * plank, y, plank, h * 0.62);
          g.fillStyle = "rgba(40,22,10,0.5)";
          g.fillRect(i * plank, y, plank, 2);
        }
        g.strokeStyle = "rgba(60,32,14,0.18)";
        g.lineWidth = 1.5;
        for (let k = 0; k < 6; k += 1) {
          const x = i * plank + 6 + rnd() * (plank - 12);
          g.beginPath();
          g.moveTo(x, 0);
          g.bezierCurveTo(x + rnd() * 8 - 4, h * 0.3, x + rnd() * 8 - 4, h * 0.7, x, h);
          g.stroke();
        }
        g.fillStyle = "rgba(20,10,4,0.55)";
        g.fillRect(i * plank, 0, 2, h);
      }
    },
    [6.5, 5.75],
  );
}

export function skylineTexture(): THREE.CanvasTexture {
  return canvasTexture(2048, 512, (g, w, h) => {
    const sky = g.createLinearGradient(0, 0, 0, h);
    sky.addColorStop(0, "#060a1e");
    sky.addColorStop(0.55, "#121a40");
    sky.addColorStop(1, "#2a2350");
    g.fillStyle = sky;
    g.fillRect(0, 0, w, h);
    for (let i = 0; i < 160; i += 1) {
      g.fillStyle = `rgba(255,255,255,${0.3 + rnd() * 0.6})`;
      g.fillRect(rnd() * w, rnd() * h * 0.45, 2, 2);
    }
    const moon = g.createRadialGradient(1560, 92, 0, 1560, 92, 90);
    moon.addColorStop(0, "rgba(255,248,226,1)");
    moon.addColorStop(0.32, "rgba(255,244,214,0.95)");
    moon.addColorStop(0.36, "rgba(200,210,255,0.25)");
    moon.addColorStop(1, "rgba(160,180,255,0)");
    g.fillStyle = moon;
    g.fillRect(1460, 0, 200, 200);
    for (const [layer, minHeight, maxHeight, tone] of [
      [0, 120, 260, 22],
      [1, 160, 380, 14],
    ] as const) {
      let x = -20;
      while (x < w) {
        const width = 50 + rnd() * 130;
        const height = minHeight + rnd() * (maxHeight - minHeight);
        const top = h - height;
        g.fillStyle = `rgb(${tone},${tone + 4},${tone + 20})`;
        g.fillRect(x, top, width, height);
        if (layer === 1) {
          const lit = 0.18 + rnd() * 0.3;
          for (let wy = top + 12; wy < h - 8; wy += 16) {
            for (let wx = x + 8; wx < x + width - 10; wx += 13) {
              if (rnd() > lit) continue;
              const warm = rnd() > 0.3;
              g.fillStyle = warm ? `rgba(255,${200 + ((rnd() * 40) | 0)},120,${0.55 + rnd() * 0.45})` : "rgba(150,220,255,0.75)";
              g.fillRect(wx, wy, 6, 8);
            }
          }
          if (rnd() > 0.6) {
            g.fillStyle = "#ff3344";
            g.beginPath();
            g.arc(x + width / 2, top - 4, 4, 0, TAU);
            g.fill();
          }
        }
        x += width + (layer === 0 ? rnd() * 10 : rnd() * 30);
      }
    }
    const haze = g.createLinearGradient(0, h * 0.6, 0, h);
    haze.addColorStop(0, "rgba(255,140,90,0)");
    haze.addColorStop(1, "rgba(255,140,90,0.22)");
    g.fillStyle = haze;
    g.fillRect(0, 0, w, h);
  });
}

export function whiteboardTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 384, (g, w, h) => {
    g.fillStyle = "#f4f6f8";
    g.fillRect(0, 0, w, h);
    g.lineCap = "round";
    g.lineJoin = "round";
    g.font = '700 54px "Marker Felt","Comic Sans MS","Avenir Next",sans-serif';
    g.fillStyle = "#1f4fbf";
    g.fillText("Q4 PARTY PLAN", 40, 76);
    g.font = '600 38px "Marker Felt","Comic Sans MS","Avenir Next",sans-serif';
    g.fillStyle = "#222831";
    g.fillText("☑ pizza", 60, 150);
    g.fillText("☑ playlist", 60, 206);
    g.fillText("☑ disco ball", 60, 262);
    g.fillStyle = "#c62828";
    g.fillText("☐ actual work", 60, 318);
    g.strokeStyle = "#222831";
    g.lineWidth = 5;
    g.beginPath();
    g.moveTo(560, 330);
    g.lineTo(980, 330);
    g.moveTo(560, 330);
    g.lineTo(560, 60);
    g.stroke();
    const bars = [60, 95, 140, 210, 270];
    bars.forEach((bar, i) => {
      g.fillStyle = ["#1f4fbf", "#2e7d32", "#ef6c00", "#c2185b", "#6a1b9a"][i]!;
      g.fillRect(590 + i * 76, 330 - bar, 48, bar);
    });
    g.strokeStyle = "#c62828";
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(600, 280);
    g.quadraticCurveTo(760, 250, 960, 60);
    g.stroke();
    g.beginPath();
    g.moveTo(960, 60);
    g.lineTo(930, 70);
    g.moveTo(960, 60);
    g.lineTo(952, 92);
    g.stroke();
    g.fillStyle = "#222831";
    g.font = '600 32px "Marker Felt","Comic Sans MS","Avenir Next",sans-serif';
    g.fillText("vibes ↑", 830, 140);
  });
}

export function bannerTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 112, (g, w, h) => {
    const colors = ["#ffb84a", "#3ad4ff", "#ff4fa3", "#8a5cff", "#5be37a"];
    const letters = "TGIF · OFFICE PARTY".split("");
    const slot = w / letters.length;
    letters.forEach((letter, i) => {
      if (letter !== " ") {
        g.fillStyle = colors[i % colors.length]!;
        g.beginPath();
        g.moveTo(i * slot + 3, 0);
        g.lineTo((i + 1) * slot - 3, 0);
        g.lineTo((i + 0.5) * slot, h);
        g.closePath();
        g.fill();
      }
      g.fillStyle = "#14121c";
      g.font = '900 40px "Arial Black","Avenir Next",sans-serif';
      g.textAlign = "center";
      g.textBaseline = "middle";
      g.fillText(letter, (i + 0.5) * slot, h * 0.34);
    });
    g.strokeStyle = "#e9e3d6";
    g.lineWidth = 4;
    g.beginPath();
    g.moveTo(0, 2);
    g.lineTo(w, 2);
    g.stroke();
  });
}

export function clockTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 256, (g, w) => {
    const c = w / 2;
    g.fillStyle = "#f5f2ea";
    g.beginPath();
    g.arc(c, c, 120, 0, TAU);
    g.fill();
    g.lineWidth = 10;
    g.strokeStyle = "#2a2d36";
    g.stroke();
    g.fillStyle = "#2a2d36";
    for (let i = 0; i < 12; i += 1) {
      const angle = (i / 12) * TAU;
      g.fillRect(c + Math.sin(angle) * 98 - 3, c - Math.cos(angle) * 98 - 8, 6, 16);
    }
    const hand = (angle: number, length: number, width: number) => {
      g.lineWidth = width;
      g.lineCap = "round";
      g.beginPath();
      g.moveTo(c, c);
      g.lineTo(c + Math.sin(angle) * length, c - Math.cos(angle) * length);
      g.stroke();
    };
    hand(((11 + 47 / 60) / 12) * TAU, 60, 9);
    hand((47 / 60) * TAU, 92, 6);
    g.strokeStyle = "#d63a3a";
    hand((12 / 60) * TAU, 96, 3);
  });
}

export function posterTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 352, (g, w, h) => {
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, "#1b2a5a");
    bg.addColorStop(1, "#3a1d5a");
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#ffd23f";
    g.lineWidth = 9;
    pawPath(g, w / 2, 140, 120);
    g.fillStyle = "#ffffff";
    g.textAlign = "center";
    g.font = '900 30px "Arial Black","Avenir Next",sans-serif';
    g.fillText("TEAMWORK", w / 2, 268);
    g.font = '700 19px "Avenir Next",Nunito,sans-serif';
    g.fillText("makes the dream work", w / 2, 300);
    g.strokeStyle = "#e9e3d6";
    g.lineWidth = 10;
    g.strokeRect(0, 0, w, h);
  });
}

export function vendingTexture(): THREE.CanvasTexture {
  return canvasTexture(256, 512, (g, w, h) => {
    g.fillStyle = "#0e1424";
    g.fillRect(0, 0, w, h);
    const colors = ["#ff4fa3", "#ffb84a", "#3ad4ff", "#5be37a", "#ff6a3d", "#8a5cff"];
    for (let row = 0; row < 6; row += 1) {
      for (let col = 0; col < 4; col += 1) {
        g.fillStyle = colors[(row + col * 2) % colors.length]!;
        g.fillRect(18 + col * 58, 24 + row * 76, 42, 54);
        g.fillStyle = "rgba(255,255,255,0.6)";
        g.fillRect(18 + col * 58, 24 + row * 76, 42, 6);
      }
      g.fillStyle = "#3a4256";
      g.fillRect(10, 82 + row * 76, w - 20, 6);
    }
  });
}

export function receptionTexture(): THREE.CanvasTexture {
  return canvasTexture(1024, 256, (g, w, h) => {
    g.fillStyle = "#1d2436";
    g.fillRect(0, 0, w, h);
    g.strokeStyle = "#ffb84a";
    g.lineWidth = 10;
    pawPath(g, 150, 136, 120);
    g.fillStyle = "#f2efe8";
    g.font = '900 104px "Arial Black","Avenir Next",sans-serif';
    g.textBaseline = "middle";
    g.fillText("PAWSWORKS", 250, 128);
  });
}
