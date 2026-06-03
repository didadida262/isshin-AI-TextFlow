import logo from "./logo_v1.png";

export default function AppLogo({
  className = "h-5 w-5",
  title = "Isshin AI TextFlow",
}: {
  className?: string;
  title?: string;
}) {
  return (
    <img
      src={logo}
      alt={title}
      className={`box-border rounded-md border border-white/28 shadow-[0_0_0_1px_rgba(255,255,255,0.06)] ${className}`}
      draggable={false}
    />
  );
}
