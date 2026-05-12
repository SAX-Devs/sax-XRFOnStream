"use client";

type Severity = "info" | "warning" | "critical";

interface Message {
  id: number;
  timestamp: string;
  severity: Severity;
  text: string;
}

const SAMPLE_MESSAGES: Message[] = [
  { id: 1, timestamp: "15:14:23", severity: "info", text: "Sistema iniciado" },
  {
    id: 2,
    timestamp: "15:14:45",
    severity: "info",
    text: "Pump peristáltico → FORWARD",
  },
  {
    id: 3,
    timestamp: "15:15:02",
    severity: "info",
    text: "Brine in Valve abierta",
  },
  {
    id: 4,
    timestamp: "15:15:08",
    severity: "info",
    text: "Iniciando medición XRF",
  },
  {
    id: 5,
    timestamp: "15:15:15",
    severity: "warning",
    text: "Cabinet T elevada (24.3 °C)",
  },
  {
    id: 6,
    timestamp: "15:15:22",
    severity: "info",
    text: "Vacuum I activado",
  },
];

function MessageItem({ message }: { message: Message }) {
  const dotColor = {
    info: "bg-blue-500",
    warning: "bg-amber-500 shadow-[0_0_6px_rgba(251,191,36,0.5)]",
    critical: "bg-red-500 shadow-[0_0_6px_rgba(239,68,68,0.6)]",
  }[message.severity];

  const tsColor = {
    info: "text-slate-500",
    warning: "text-amber-400",
    critical: "text-red-400",
  }[message.severity];

  return (
    <li className="border-b border-white/5 px-3 py-2 transition-colors hover:bg-white/[0.03]">
      <div className="flex items-start gap-2">
        <span
          className={`mt-1.5 inline-flex h-1.5 w-1.5 flex-shrink-0 rounded-full ${dotColor}`}
        />
        <div className="min-w-0 flex-1">
          <div
            className={`font-mono text-[10px] font-semibold tabular-nums ${tsColor}`}
          >
            {message.timestamp}
          </div>
          <div className="mt-0.5 text-[11px] leading-snug text-slate-300">
            {message.text}
          </div>
        </div>
      </div>
    </li>
  );
}

interface MessagesPanelProps {
  messages?: Message[];
}

export function MessagesPanel({
  messages = SAMPLE_MESSAGES,
}: MessagesPanelProps) {
  return (
    <div className="flex flex-col rounded-2xl border border-white/10 bg-black/60 backdrop-blur-md">
      <div className="flex items-center justify-between border-b border-white/10 px-3 py-2">
        <h2 className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
          Mensajes
        </h2>
        <span className="font-mono text-[10px] text-slate-500">
          {messages.length}
        </span>
      </div>
      <ul className="flex-1 overflow-y-auto" style={{ maxHeight: "320px" }}>
        {messages
          .slice()
          .reverse()
          .map((msg) => (
            <MessageItem key={msg.id} message={msg} />
          ))}
      </ul>
    </div>
  );
}
