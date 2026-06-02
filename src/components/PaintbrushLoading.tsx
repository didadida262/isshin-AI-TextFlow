import { useId } from "react";

interface PaintbrushLoadingProps {
  label?: string;
}

const DRAW_PATH = "M12 62 C28 48, 36 28, 58 38 S92 58, 118 32 S142 22, 148 28";

const RAINBOW_STOPS = [
  { offset: "0%", color: "#ff5757" },
  { offset: "14%", color: "#ff5757" },
  { offset: "14%", color: "#ffa502" },
  { offset: "28%", color: "#ffa502" },
  { offset: "28%", color: "#ffdd59" },
  { offset: "42%", color: "#ffdd59" },
  { offset: "42%", color: "#2ed573" },
  { offset: "56%", color: "#2ed573" },
  { offset: "56%", color: "#22d3ee" },
  { offset: "70%", color: "#22d3ee" },
  { offset: "70%", color: "#5352ed" },
  { offset: "84%", color: "#5352ed" },
  { offset: "84%", color: "#e056fd" },
  { offset: "100%", color: "#e056fd" },
];

export function PaintbrushLoading({ label }: PaintbrushLoadingProps) {
  const uid = useId().replace(/:/g, "");
  const gradientId = `paintbrush-rainbow-${uid}`;
  const glowFilterId = `paintbrush-glow-${uid}`;

  return (
    <div className="paintbrush-loading flex flex-col items-center">
      <svg
        viewBox="0 0 160 90"
        className="h-[88px] w-[140px] overflow-visible"
        aria-hidden={label ? undefined : true}
      >
        <defs>
          <linearGradient
            id={gradientId}
            gradientUnits="userSpaceOnUse"
            x1="0"
            y1="45"
            x2="160"
            y2="45"
          >
            {RAINBOW_STOPS.map((stop) => (
              <stop key={`${stop.offset}-${stop.color}`} offset={stop.offset} stopColor={stop.color} />
            ))}
            <animateTransform
              attributeName="gradientTransform"
              type="translate"
              from="-40 0"
              to="40 0"
              dur="1.8s"
              repeatCount="indefinite"
            />
          </linearGradient>

          <filter id={glowFilterId} x="-30%" y="-30%" width="160%" height="160%">
            <feGaussianBlur stdDeviation="3" result="blur" />
            <feMerge>
              <feMergeNode in="blur" />
              <feMergeNode in="SourceGraphic" />
            </feMerge>
          </filter>
        </defs>

        <rect
          x="8"
          y="12"
          width="144"
          height="66"
          rx="6"
          className="paintbrush-loading-canvas"
        />

        <path
          d={DRAW_PATH}
          className="paintbrush-draw-glow"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="7"
          strokeLinecap="round"
          filter={`url(#${glowFilterId})`}
        />

        <path
          d={DRAW_PATH}
          className="paintbrush-draw-path"
          fill="none"
          stroke={`url(#${gradientId})`}
          strokeWidth="3"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        <g className="paintbrush-draw-brush">
          <circle cx="0" cy="0" r="3" fill={`url(#${gradientId})`} />
          <path d="M0 0 L10 3 L10 -3 Z" fill={`url(#${gradientId})`} opacity="0.95" />
          <rect x="9" y="-3.5" width="5" height="7" rx="1" fill="#888888" />
          <rect x="13" y="-2.5" width="18" height="5" rx="2.5" fill="#c9a86c" />
        </g>
      </svg>

      {label ? (
        <p className="mt-4 text-sm font-medium text-white">{label}</p>
      ) : null}
    </div>
  );
}
