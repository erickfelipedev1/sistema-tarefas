const sizes = {
  xs: "h-5 w-5 text-[9px]",
  sm: "h-7 w-7 text-[11px]",
  md: "h-9 w-9 text-xs",
};

export function Avatar({
  name,
  src,
  size = "sm",
  className = "",
}: {
  name: string | null | undefined;
  src?: string | null;
  size?: keyof typeof sizes;
  className?: string;
}) {
  const inicial = (name || "?").trim().slice(0, 1).toUpperCase();
  return (
    <span
      className={`flex flex-shrink-0 items-center justify-center overflow-hidden rounded-full bg-navy font-semibold text-white ${sizes[size]} ${className}`}
      title={name ?? undefined}
    >
      {src ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={src} alt="" className="h-full w-full object-cover" />
      ) : (
        inicial
      )}
    </span>
  );
}
