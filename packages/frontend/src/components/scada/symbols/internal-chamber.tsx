interface InternalChamberProps {
  x: number;
  y: number;
  width: number;
  height: number;
  hvOn: boolean;
  measuring: boolean;
  /** Absolute coords of the measurement point on the window (tube & detector aim here). */
  pointX: number;
  pointY: number;
  /** Show P&ID tags (GEN-001, DET-001) — typically only in Service screen. */
  showTags?: boolean;
}

/**
 * Inner "cámara interna" — the sealed optical side. Holds the X-ray tube and
 * the detector, BOTH angled toward the honeycomb window (to the left), where
 * the sample passes. The tube irradiates the sample through the window and
 * the detector reads the fluorescence that comes back.
 */
export function InternalChamber({
  x,
  y,
  width,
  height,
  hvOn,
  measuring,
  pointX,
  pointY,
  showTags = false,
}: InternalChamberProps) {
  const cx = x + width / 2;
  const tubeColor = hvOn ? "#fbbf24" : "#64748b";
  const detColor = measuring ? "#22d3ee" : "#64748b";
  const beamOn = hvOn && measuring;

  // Tube (upper) and detector (lower), both on the right, noses toward the window
  const tubeCx = x + width * 0.6;
  const tubeCy = y + height * 0.3;
  const detCx = x + width * 0.6;
  const detCy = y + height * 0.7;
  const tubeL = 30;
  const detL = 26;

  // Rotation so each nose (drawn pointing left, 180°) aims at the window point
  const angTube = (Math.atan2(pointY - tubeCy, pointX - tubeCx) * 180) / Math.PI;
  const angDet = (Math.atan2(pointY - detCy, pointX - detCx) * 180) / Math.PI;
  const rTube = angTube - 180;
  const rDet = angDet - 180;

  const noseTube = {
    x: tubeCx - tubeL * Math.cos((rTube * Math.PI) / 180),
    y: tubeCy - tubeL * Math.sin((rTube * Math.PI) / 180),
  };
  const noseDet = {
    x: detCx - detL * Math.cos((rDet * Math.PI) / 180),
    y: detCy - detL * Math.sin((rDet * Math.PI) / 180),
  };

  const colorTransition = { transition: "fill 0.4s ease-in-out, stroke 0.4s ease-in-out" };

  return (
    <g>
      {/* Chamber body */}
      <rect
        x={x}
        y={y}
        width={width}
        height={height}
        rx="6"
        fill="#0b1220"
        stroke="#64748b"
        strokeWidth="1.5"
      />
      <rect
        x={x + 3}
        y={y + 3}
        width={width - 6}
        height={height - 6}
        rx="4"
        fill="none"
        stroke="#1e293b"
        strokeWidth="1"
      />

      {/* Radiation beam: tube → window point → detector */}
      {beamOn && (
        <g>
          <line
            x1={noseTube.x}
            y1={noseTube.y}
            x2={pointX}
            y2={pointY}
            stroke="#fde047"
            strokeWidth="2"
            strokeLinecap="round"
            filter="url(#detector-glow)"
          >
            <animate
              attributeName="opacity"
              values="0.45;0.9;0.45"
              dur="1.6s"
              repeatCount="indefinite"
            />
          </line>
          <line
            x1={pointX}
            y1={pointY}
            x2={noseDet.x}
            y2={noseDet.y}
            stroke="#22d3ee"
            strokeWidth="2"
            strokeLinecap="round"
            filter="url(#detector-glow)"
          >
            <animate
              attributeName="opacity"
              values="0.45;0.9;0.45"
              dur="1.6s"
              begin="0.2s"
              repeatCount="indefinite"
            />
          </line>
          <circle cx={pointX} cy={pointY} r="3.5" fill="#fde047">
            <animate
              attributeName="r"
              values="2.5;4;2.5"
              dur="1.6s"
              repeatCount="indefinite"
            />
          </circle>
        </g>
      )}

      {/* X-ray tube (upper), nose toward the window */}
      <g transform={`translate(${tubeCx}, ${tubeCy}) rotate(${rTube})`}>
        <rect
          x={-tubeL}
          y={-7}
          width={tubeL + 12}
          height="14"
          rx="3"
          fill="#451a03"
          stroke={tubeColor}
          strokeWidth="1.5"
          style={colorTransition}
        />
        {/* emission window at the nose */}
        <rect x={-tubeL - 2} y={-3} width="4" height="6" fill={tubeColor} style={colorTransition} />
        {/* anode hint */}
        <circle cx="7" cy="0" r="3" fill={tubeColor} opacity="0.7" style={colorTransition} />
        {/* RX identifier */}
        <text
          x={-11}
          y={3.5}
          textAnchor="middle"
          fontSize="10"
          fontWeight="800"
          fill="#fde047"
          fontFamily="ui-sans-serif, system-ui"
          letterSpacing="0.5"
        >
          RX
        </text>
      </g>

      {/* Detector (lower), sensor toward the window */}
      <g transform={`translate(${detCx}, ${detCy}) rotate(${rDet})`}>
        <rect
          x={-detL}
          y={-8}
          width={detL + 12}
          height="16"
          rx="3"
          fill="#0c4a6e"
          stroke={detColor}
          strokeWidth="1.5"
          style={colorTransition}
        />
        {/* sensor window at the nose */}
        <rect x={-detL - 2} y={-4} width="4" height="8" fill={detColor} style={colorTransition} />
        {/* SDD identifier — Silicon Drift Detector (standard XRF detector type) */}
        <text
          x={-7}
          y={3.5}
          textAnchor="middle"
          fontSize="10"
          fontWeight="800"
          fill="#67e8f9"
          fontFamily="ui-sans-serif, system-ui"
          letterSpacing="0.5"
        >
          SDD
        </text>
      </g>

      {/* Title + device tags */}
      <text
        x={cx}
        y={y + 15}
        textAnchor="middle"
        fontSize="9"
        fontWeight="700"
        letterSpacing="1"
        fill="#cbd5e1"
        fontFamily="ui-sans-serif, system-ui"
      >
        INTERNAL CHAMBER
      </text>
      {showTags && (
        <>
          <text
            x={x + width - 8}
            y={y + height - 20}
            textAnchor="end"
            fontSize="8"
            fill="#a16207"
            fontFamily="ui-monospace, monospace"
          >
            GEN-001
          </text>
          <text
            x={x + width - 8}
            y={y + height - 9}
            textAnchor="end"
            fontSize="8"
            fill="#0e7490"
            fontFamily="ui-monospace, monospace"
          >
            DET-001
          </text>
        </>
      )}
    </g>
  );
}
