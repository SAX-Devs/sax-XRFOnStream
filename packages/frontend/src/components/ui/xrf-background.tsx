"use client";

import { useEffect, useRef } from "react";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Atom {
  x: number;
  y: number;
  vx: number;
  vy: number;
  radius: number;
  orbitRadius: number;
  orbitAngle: number;
  orbitSpeed: number;
  exciteTimer: number;
  exciteIntensity: number;
  element: string;
  color: string;
}

interface Photon {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
}

interface Emission {
  x: number;
  y: number;
  vx: number;
  vy: number;
  life: number;
  maxLife: number;
  color: string;
  size: number;
}

interface Connection {
  a: Atom;
  b: Atom;
  distance: number;
}

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------

const ELEMENT_COLORS: { element: string; color: string }[] = [
  { element: "Fe", color: "#00e5ff" },
  { element: "Cu", color: "#76ff03" },
  { element: "Zn", color: "#ffd740" },
  { element: "Pb", color: "#e040fb" },
  { element: "Ag", color: "#7c4dff" },
  { element: "Ca", color: "#ff6e40" },
];

const EMISSION_COLORS = [
  "#00e5ff",
  "#76ff03",
  "#ffd740",
  "#e040fb",
  "#7c4dff",
  "#ff6e40",
];

const PHOTON_COLOR = "#ff1744";
const CONNECTION_MAX_DIST = 180;

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function XRFBackground() {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let width = 0;
    let height = 0;

    // State
    const atoms: Atom[] = [];
    const photons: Photon[] = [];
    const emissions: Emission[] = [];

    // -----------------------------------------------------------------------
    // Resize
    // -----------------------------------------------------------------------

    function resize() {
      const dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;
      canvas!.width = width * dpr;
      canvas!.height = height * dpr;
      canvas!.style.width = `${width}px`;
      canvas!.style.height = `${height}px`;
      ctx!.setTransform(dpr, 0, 0, dpr, 0, 0);
    }

    // -----------------------------------------------------------------------
    // Factory helpers
    // -----------------------------------------------------------------------

    function createAtom(): Atom {
      const el =
        ELEMENT_COLORS[Math.floor(Math.random() * ELEMENT_COLORS.length)];
      return {
        x: Math.random() * width,
        y: Math.random() * height,
        vx: (Math.random() - 0.5) * 0.3,
        vy: (Math.random() - 0.5) * 0.3,
        radius: 3 + Math.random() * 3,
        orbitRadius: 12 + Math.random() * 14,
        orbitAngle: Math.random() * Math.PI * 2,
        orbitSpeed: 0.005 + Math.random() * 0.015,
        exciteTimer: 0,
        exciteIntensity: 0,
        element: el.element,
        color: el.color,
      };
    }

    function createPhoton(): Photon {
      const edge = Math.floor(Math.random() * 4);
      let x: number, y: number, vx: number, vy: number;
      const speed = 1.5 + Math.random() * 2;

      switch (edge) {
        case 0: // top
          x = Math.random() * width;
          y = -10;
          vx = (Math.random() - 0.5) * 1.5;
          vy = speed;
          break;
        case 1: // right
          x = width + 10;
          y = Math.random() * height;
          vx = -speed;
          vy = (Math.random() - 0.5) * 1.5;
          break;
        case 2: // bottom
          x = Math.random() * width;
          y = height + 10;
          vx = (Math.random() - 0.5) * 1.5;
          vy = -speed;
          break;
        default: // left
          x = -10;
          y = Math.random() * height;
          vx = speed;
          vy = (Math.random() - 0.5) * 1.5;
          break;
      }

      return { x, y, vx, vy, life: 0, maxLife: 400 + Math.random() * 200 };
    }

    function createEmission(atom: Atom): Emission {
      const angle = Math.random() * Math.PI * 2;
      const speed = 1 + Math.random() * 2.5;
      return {
        x: atom.x,
        y: atom.y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0,
        maxLife: 60 + Math.random() * 40,
        color:
          EMISSION_COLORS[Math.floor(Math.random() * EMISSION_COLORS.length)],
        size: 1.5 + Math.random() * 2,
      };
    }

    // -----------------------------------------------------------------------
    // Init
    // -----------------------------------------------------------------------

    function init() {
      atoms.length = 0;
      photons.length = 0;
      emissions.length = 0;

      const count = Math.floor((width * height) / 25000);
      for (let i = 0; i < Math.max(count, 12); i++) {
        atoms.push(createAtom());
      }
    }

    // -----------------------------------------------------------------------
    // Update
    // -----------------------------------------------------------------------

    let photonTimer = 0;

    function update() {
      // Spawn photons
      photonTimer++;
      if (photonTimer > 12) {
        photons.push(createPhoton());
        photonTimer = 0;
      }

      // Update atoms
      for (const atom of atoms) {
        atom.x += atom.vx;
        atom.y += atom.vy;
        atom.orbitAngle += atom.orbitSpeed;

        // Bounce off edges
        if (atom.x < -50) atom.vx = Math.abs(atom.vx);
        if (atom.x > width + 50) atom.vx = -Math.abs(atom.vx);
        if (atom.y < -50) atom.vy = Math.abs(atom.vy);
        if (atom.y > height + 50) atom.vy = -Math.abs(atom.vy);

        // Decay excitation
        if (atom.exciteTimer > 0) {
          atom.exciteTimer--;
          atom.exciteIntensity = atom.exciteTimer / 60;
        }
      }

      // Update photons & check collisions
      for (let i = photons.length - 1; i >= 0; i--) {
        const p = photons[i];
        p.x += p.vx;
        p.y += p.vy;
        p.life++;

        // Remove if expired or out of bounds
        if (
          p.life > p.maxLife ||
          p.x < -50 ||
          p.x > width + 50 ||
          p.y < -50 ||
          p.y > height + 50
        ) {
          photons.splice(i, 1);
          continue;
        }

        // Check collision with atoms
        for (const atom of atoms) {
          const dx = p.x - atom.x;
          const dy = p.y - atom.y;
          const dist = Math.sqrt(dx * dx + dy * dy);

          if (dist < atom.orbitRadius + 5) {
            // Excite atom
            atom.exciteTimer = 60;
            atom.exciteIntensity = 1;

            // Emit fluorescent particles
            const emitCount = 3 + Math.floor(Math.random() * 4);
            for (let j = 0; j < emitCount; j++) {
              emissions.push(createEmission(atom));
            }

            // Remove photon
            photons.splice(i, 1);
            break;
          }
        }
      }

      // Update emissions
      for (let i = emissions.length - 1; i >= 0; i--) {
        const e = emissions[i];
        e.x += e.vx;
        e.y += e.vy;
        e.vx *= 0.98;
        e.vy *= 0.98;
        e.life++;

        if (e.life > e.maxLife) {
          emissions.splice(i, 1);
        }
      }
    }

    // -----------------------------------------------------------------------
    // Draw
    // -----------------------------------------------------------------------

    function draw() {
      ctx!.clearRect(0, 0, width, height);

      // Background gradient
      const bg = ctx!.createRadialGradient(
        width / 2,
        height / 2,
        0,
        width / 2,
        height / 2,
        Math.max(width, height) * 0.7
      );
      bg.addColorStop(0, "#0a0a1a");
      bg.addColorStop(1, "#050510");
      ctx!.fillStyle = bg;
      ctx!.fillRect(0, 0, width, height);

      // Connections
      const connections: Connection[] = [];
      for (let i = 0; i < atoms.length; i++) {
        for (let j = i + 1; j < atoms.length; j++) {
          const dx = atoms[i].x - atoms[j].x;
          const dy = atoms[i].y - atoms[j].y;
          const dist = Math.sqrt(dx * dx + dy * dy);
          if (dist < CONNECTION_MAX_DIST) {
            connections.push({ a: atoms[i], b: atoms[j], distance: dist });
          }
        }
      }

      for (const conn of connections) {
        const alpha = (1 - conn.distance / CONNECTION_MAX_DIST) * 0.12;
        ctx!.strokeStyle = `rgba(100, 180, 255, ${alpha})`;
        ctx!.lineWidth = 0.5;
        ctx!.beginPath();
        ctx!.moveTo(conn.a.x, conn.a.y);
        ctx!.lineTo(conn.b.x, conn.b.y);
        ctx!.stroke();
      }

      // Atoms
      for (const atom of atoms) {
        const excited = atom.exciteIntensity;

        // Orbit ring
        ctx!.strokeStyle = excited > 0
          ? `rgba(255, 255, 255, ${0.15 + excited * 0.6})`
          : `rgba(100, 180, 255, 0.15)`;
        ctx!.lineWidth = 0.8;
        ctx!.beginPath();
        ctx!.ellipse(
          atom.x,
          atom.y,
          atom.orbitRadius,
          atom.orbitRadius * 0.4,
          atom.orbitAngle,
          0,
          Math.PI * 2
        );
        ctx!.stroke();

        // Second orbit (perpendicular)
        ctx!.beginPath();
        ctx!.ellipse(
          atom.x,
          atom.y,
          atom.orbitRadius * 0.7,
          atom.orbitRadius * 0.35,
          atom.orbitAngle + Math.PI / 2,
          0,
          Math.PI * 2
        );
        ctx!.stroke();

        // Nucleus glow when excited
        if (excited > 0) {
          const glowGrad = ctx!.createRadialGradient(
            atom.x,
            atom.y,
            0,
            atom.x,
            atom.y,
            atom.orbitRadius * (1 + excited)
          );
          glowGrad.addColorStop(0, `rgba(255, 255, 255, ${excited * 0.4})`);
          glowGrad.addColorStop(0.3, `${atom.color}${Math.floor(excited * 60).toString(16).padStart(2, "0")}`);
          glowGrad.addColorStop(1, "transparent");
          ctx!.fillStyle = glowGrad;
          ctx!.beginPath();
          ctx!.arc(atom.x, atom.y, atom.orbitRadius * (1 + excited), 0, Math.PI * 2);
          ctx!.fill();
        }

        // Nucleus
        const nucleusGrad = ctx!.createRadialGradient(
          atom.x - atom.radius * 0.3,
          atom.y - atom.radius * 0.3,
          0,
          atom.x,
          atom.y,
          atom.radius
        );
        nucleusGrad.addColorStop(0, excited > 0 ? "#ffffff" : atom.color);
        nucleusGrad.addColorStop(1, excited > 0 ? atom.color : "#1a1a3a");
        ctx!.fillStyle = nucleusGrad;
        ctx!.beginPath();
        ctx!.arc(atom.x, atom.y, atom.radius, 0, Math.PI * 2);
        ctx!.fill();

        // Electron on orbit
        const ex = atom.x + Math.cos(atom.orbitAngle * 3) * atom.orbitRadius;
        const ey =
          atom.y +
          Math.sin(atom.orbitAngle * 3) * atom.orbitRadius * 0.4;
        ctx!.fillStyle = `rgba(200, 230, 255, ${0.5 + excited * 0.5})`;
        ctx!.beginPath();
        ctx!.arc(ex, ey, 1.5, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Photons (X-ray beam — red)
      for (const p of photons) {
        const alpha = Math.min(1, 1 - p.life / p.maxLife);

        // Trail
        const trailLen = 15;
        const grad = ctx!.createLinearGradient(
          p.x - p.vx * trailLen,
          p.y - p.vy * trailLen,
          p.x,
          p.y
        );
        grad.addColorStop(0, "transparent");
        grad.addColorStop(1, `rgba(255, 23, 68, ${alpha * 0.6})`);
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = 2;
        ctx!.beginPath();
        ctx!.moveTo(p.x - p.vx * trailLen, p.y - p.vy * trailLen);
        ctx!.lineTo(p.x, p.y);
        ctx!.stroke();

        // Head glow
        const headGrad = ctx!.createRadialGradient(p.x, p.y, 0, p.x, p.y, 6);
        headGrad.addColorStop(0, `rgba(255, 23, 68, ${alpha * 0.8})`);
        headGrad.addColorStop(1, "transparent");
        ctx!.fillStyle = headGrad;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 6, 0, Math.PI * 2);
        ctx!.fill();

        // Core
        ctx!.fillStyle = `rgba(255, 100, 120, ${alpha})`;
        ctx!.beginPath();
        ctx!.arc(p.x, p.y, 1.5, 0, Math.PI * 2);
        ctx!.fill();
      }

      // Emissions (fluorescent radiation)
      for (const e of emissions) {
        const alpha = 1 - e.life / e.maxLife;

        // Trail
        const trailLen = 8;
        const grad = ctx!.createLinearGradient(
          e.x - e.vx * trailLen,
          e.y - e.vy * trailLen,
          e.x,
          e.y
        );
        grad.addColorStop(0, "transparent");
        grad.addColorStop(1, e.color + Math.floor(alpha * 150).toString(16).padStart(2, "0"));
        ctx!.strokeStyle = grad;
        ctx!.lineWidth = e.size * 0.8;
        ctx!.beginPath();
        ctx!.moveTo(e.x - e.vx * trailLen, e.y - e.vy * trailLen);
        ctx!.lineTo(e.x, e.y);
        ctx!.stroke();

        // Particle
        ctx!.fillStyle = e.color + Math.floor(alpha * 255).toString(16).padStart(2, "0");
        ctx!.beginPath();
        ctx!.arc(e.x, e.y, e.size * alpha, 0, Math.PI * 2);
        ctx!.fill();
      }
    }

    // -----------------------------------------------------------------------
    // Loop
    // -----------------------------------------------------------------------

    function loop() {
      update();
      draw();
      animationId = requestAnimationFrame(loop);
    }

    resize();
    init();
    loop();

    window.addEventListener("resize", () => {
      resize();
      init();
    });

    return () => {
      cancelAnimationFrame(animationId);
      window.removeEventListener("resize", resize);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 -z-0"
      aria-hidden="true"
    />
  );
}
