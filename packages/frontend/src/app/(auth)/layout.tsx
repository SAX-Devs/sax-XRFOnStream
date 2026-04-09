import { XRFBackground } from "@/components/ui/xrf-background";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#050510]">
      <XRFBackground />
      <div className="relative z-10 w-full max-w-md px-4">{children}</div>
    </div>
  );
}
