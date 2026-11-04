import { useImageUrl } from "../lib/useImageUrl.js";

type StorageImageProps = {
  path: string;
  className?: string;
};

export function StorageImage({ path, className }: StorageImageProps) {
  const query = useImageUrl(path);

  if (query.isLoading || !query.data) {
    return (
      <div
        className={[className, "bg-surface animate-pulse"]
          .filter(Boolean)
          .join(" ")}
      />
    );
  }

  return <img src={query.data} alt="" className={className} />;
}
