interface AssetTypeTagLabels {
  typeCharacter: string;
  typeScene: string;
  typeProp: string;
}

interface AssetTypeTagProps {
  assetType: string;
  labels: AssetTypeTagLabels;
  className?: string;
}

function tagStyle(assetType: string): string {
  if (assetType === "character") {
    return "border-cyan-400/30 bg-cyan-400/10 text-cyan-300";
  }
  if (assetType === "prop") {
    return "border-amber-400/30 bg-amber-400/10 text-amber-300";
  }
  return "border-violet-400/30 bg-violet-400/10 text-violet-300";
}

function tagLabel(assetType: string, labels: AssetTypeTagLabels): string {
  if (assetType === "character") return labels.typeCharacter;
  if (assetType === "prop") return labels.typeProp;
  return labels.typeScene;
}

export function AssetTypeTag({
  assetType,
  labels,
  className = "",
}: AssetTypeTagProps) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded border px-2 py-0.5 text-[11px] font-medium leading-none ${tagStyle(assetType)} ${className}`}
    >
      {tagLabel(assetType, labels)}
    </span>
  );
}
