import { useEffect, useMemo, useRef, useState } from "react";
import type { LucideIcon } from "lucide-react";

export interface ConstellationMove {
  id: string;
  title: string;
  detail: string;
  icon: LucideIcon;
  onRun: () => void;
}

interface SourceConstellationProps {
  documents: { id: number; filename: string }[];
  moves: ConstellationMove[];
  /** Persona label used for the accessible name of the moves region, e.g. "Teaching modes". */
  modesLabel: string;
}

const VIEW_W = 600;
const VIEW_H = 272;
const CX = 300;
const CY = 162;
const MAX_SOURCES = 6;

// Spring + orbit tuning. Damping below 1 gives a calm settle, never a bounce.
const STIFFNESS = 0.018;
const DAMPING = 0.85;

type SimNode = {
  baseAngle: number;
  radius: number;
  depth: number;
  phase: number;
  releaseAt: number;
  x: number;
  y: number;
  vx: number;
  vy: number;
  node: SVGGElement | null;
  thread: SVGPathElement | null;
  flow: SVGPathElement | null;
};

function threadPath(x: number, y: number): string {
  const dx = x - CX;
  const dy = y - CY;
  const len = Math.hypot(dx, dy) || 1;
  const mx = (CX + x) / 2;
  const my = (CY + y) / 2;
  // Bow the thread perpendicular to its run so lines never look like spokes.
  const nx = -dy / len;
  const ny = dx / len;
  const bow = 14;
  return `M${CX} ${CY} Q${(mx + nx * bow).toFixed(2)} ${(my + ny * bow).toFixed(2)} ${x.toFixed(2)} ${y.toFixed(2)}`;
}

export default function SourceConstellation({
  documents,
  moves,
  modesLabel,
}: SourceConstellationProps) {
  const sources = useMemo(() => documents.slice(0, MAX_SOURCES), [documents]);
  const overflow = documents.length - sources.length;
  // Stable identity so the simulation only restarts when the source set changes.
  const signature = sources.map((doc) => doc.id).join(",");

  const figureRef = useRef<HTMLDivElement | null>(null);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const pointer = useRef({ x: 0, y: 0, tx: 0, ty: 0 });
  const activeRef = useRef(false);
  const [active, setActive] = useState(false);

  useEffect(() => {
    activeRef.current = active;
  }, [active]);

  useEffect(() => {
    const svg = svgRef.current;
    if (!svg || sources.length === 0) return;

    const reduceMotion =
      typeof window !== "undefined" && typeof window.matchMedia === "function"
        ? window.matchMedia("(prefers-reduced-motion: reduce)").matches
        : false;

    const count = sources.length;
    const nodes: SimNode[] = sources.map((_, i) => {
      const t = (i + 0.5) / count;
      return {
        // Distribute across the upper arc so sources crown the session core.
        baseAngle: Math.PI * 1.12 + t * Math.PI * 0.76,
        radius: 122 + (i % 2) * 18,
        depth: 0.55 + ((i * 0.37) % 1) * 0.45,
        phase: i * 1.7,
        releaseAt: 110 + i * 95,
        x: CX,
        y: CY,
        vx: 0,
        vy: 0,
        node: svg.querySelector<SVGGElement>(`[data-node="${i}"]`),
        thread: svg.querySelector<SVGPathElement>(`[data-thread="${i}"]`),
        flow: svg.querySelector<SVGPathElement>(`[data-flow="${i}"]`),
      };
    });

    const orbit = (n: SimNode, elapsed: number) => {
      const rot = elapsed * 0.000018 * Math.PI * 2 * n.depth;
      const ang = n.baseAngle + rot;
      const breathe = 1 + Math.sin(elapsed * 0.0004 + n.phase) * 0.05;
      const r = n.radius * breathe;
      const px = pointer.current.x * 16 * n.depth;
      const py = pointer.current.y * 11 * n.depth;
      return {
        x: CX + Math.cos(ang) * r + px,
        y: CY + Math.sin(ang) * r * 0.74 + py,
      };
    };

    const write = (n: SimNode) => {
      if (n.node) n.node.setAttribute("transform", `translate(${n.x.toFixed(2)} ${n.y.toFixed(2)})`);
      const d = threadPath(n.x, n.y);
      if (n.thread) n.thread.setAttribute("d", d);
      if (n.flow) n.flow.setAttribute("d", d);
    };

    if (reduceMotion) {
      // Honour reduced motion: settle every node at its resting orbit, no loop.
      for (const n of nodes) {
        const ang = n.baseAngle;
        n.x = CX + Math.cos(ang) * n.radius;
        n.y = CY + Math.sin(ang) * n.radius * 0.74;
        write(n);
      }
      return;
    }

    let raf = 0;
    let start = 0;
    const frame = (time: number) => {
      if (!start) start = time;
      const elapsed = time - start;
      // Ease pointer toward its target for buttery parallax.
      pointer.current.x += (pointer.current.tx - pointer.current.x) * 0.08;
      pointer.current.y += (pointer.current.ty - pointer.current.y) * 0.08;
      for (const n of nodes) {
        const target = elapsed > n.releaseAt ? orbit(n, elapsed) : { x: CX, y: CY };
        n.vx = (n.vx + (target.x - n.x) * STIFFNESS) * DAMPING;
        n.vy = (n.vy + (target.y - n.y) * STIFFNESS) * DAMPING;
        n.x += n.vx;
        n.y += n.vy;
        write(n);
      }
      raf = requestAnimationFrame(frame);
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [signature, sources]);

  const onPointerMove = (event: React.PointerEvent<HTMLDivElement>) => {
    const rect = figureRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointer.current.tx = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
    pointer.current.ty = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
  };
  const onPointerLeave = () => {
    pointer.current.tx = 0;
    pointer.current.ty = 0;
  };

  const summary =
    sources.length === 1
      ? "One source connected to this study session."
      : `${sources.length} sources connected to this study session.`;

  return (
    <div className={`readyConstellation${active ? " is-active" : ""}`}>
      <div className="rcLede">
        <h3>Ready when you are</h3>
        <p>Open a guided move or ask your own question — every answer stays tied to your sources.</p>
      </div>

      <div
        className="rcFigure"
        ref={figureRef}
        onPointerMove={onPointerMove}
        onPointerLeave={onPointerLeave}
      >
        <svg
          ref={svgRef}
          className="constellation"
          viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
          role="img"
          aria-label={summary}
          preserveAspectRatio="xMidYMid meet"
        >
          <g className="cst-threads">
            {sources.map((doc, i) => (
              <path
                key={`thread-${doc.id}`}
                data-thread={i}
                className="cst-thread"
                style={{ animationDelay: `${i * 95}ms` }}
                d={threadPath(CX, CY)}
              />
            ))}
            {sources.map((doc, i) => (
              <path
                key={`flow-${doc.id}`}
                data-flow={i}
                className="cst-flow"
                pathLength={1}
                style={{ animationDelay: `${i * 95}ms` }}
                d={threadPath(CX, CY)}
              />
            ))}
          </g>

          {sources.map((doc, i) => (
            <g
              key={`node-${doc.id}`}
              data-node={i}
              className="cst-node"
              style={{ animationDelay: `${260 + i * 95}ms` }}
              transform={`translate(${CX} ${CY})`}
            >
              <title>{doc.filename}</title>
              <circle className="cst-node-halo" r={17} />
              <circle className="cst-node-disc" r={13} />
              <text className="cst-node-num" dominantBaseline="central" textAnchor="middle">
                {i + 1}
              </text>
            </g>
          ))}

          <g className="cst-core" transform={`translate(${CX} ${CY})`}>
            <circle className="cst-core-pulse" r={30} />
            <circle className="cst-core-disc" r={30} />
            <text className="cst-core-label" dominantBaseline="central" textAnchor="middle">
              Ask
            </text>
          </g>
        </svg>
      </div>

      {moves.length > 0 ? (
        <div className="rcMoves" aria-label={`${modesLabel} composer suggestions`}>
          {moves.map((move) => {
            const Icon = move.icon;
            return (
              <button
                key={move.id}
                type="button"
                className="rcMove"
                aria-label={move.title}
                onClick={move.onRun}
                onMouseEnter={() => setActive(true)}
                onMouseLeave={() => setActive(false)}
                onFocus={() => setActive(true)}
                onBlur={() => setActive(false)}
              >
                <Icon size={15} aria-hidden="true" />
                <span className="rcMoveTitle">{move.title}</span>
                <span className="rcMoveDetail" aria-hidden="true">
                  {move.detail}
                </span>
              </button>
            );
          })}
        </div>
      ) : null}

      <p className="rcLegend" aria-label="Selected ready files">
        <span className="rcLegendLead">Tied to</span>
        {sources.map((doc, i) => (
          <span className="rcLegendItem" key={doc.id}>
            <b aria-hidden="true">{i + 1}</b>
            {doc.filename}
          </span>
        ))}
        {overflow > 0 ? <span className="rcLegendMore">+{overflow} more</span> : null}
      </p>
    </div>
  );
}
