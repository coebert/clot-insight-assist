import logoUrl from "@/assets/logo.png";

export function Logo({
  size = 32,
  withWordmark = false,
  className = "",
}: {
  size?: number;
  withWordmark?: boolean;
  className?: string;
}) {
  return (
    <div className={`inline-flex items-center gap-2.5 ${className}`}>
      <img
        src={logoUrl}
        alt="Clot Clarity logo"
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className="drop-shadow-[0_0_12px_rgba(220,38,60,0.35)]"
      />
      {withWordmark && (
        <span className="text-base font-semibold tracking-tight text-foreground">
          Clot Clarity
        </span>
      )}
    </div>
  );
}
