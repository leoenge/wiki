import { StarHalfIcon, StarIcon } from "@phosphor-icons/react";
import { useState } from "react";

type StarRatingProps = {
  value: number | null;
  interactive?: boolean;
  onChange?: (value: number | null) => void;
  size?: number;
};

function starFill(
  index: number,
  displayValue: number | null,
): "empty" | "half" | "full" {
  if (displayValue === null) {
    return "empty";
  }
  if (displayValue >= index + 1) {
    return "full";
  }
  if (displayValue >= index + 0.5) {
    return "half";
  }
  return "empty";
}

export function StarRating({
  value,
  interactive = false,
  onChange,
  size = 20,
}: StarRatingProps) {
  const [hoverValue, setHoverValue] = useState<number | null>(null);
  const display = interactive && hoverValue !== null ? hoverValue : value;

  function pickStar(starIndex: number, half: boolean) {
    if (!interactive || !onChange) {
      return;
    }
    const next = starIndex + (half ? 0.5 : 1);
    onChange(next);
  }

  return (
    <span
      className="inline-flex items-center gap-0.5"
      onMouseLeave={() => interactive && setHoverValue(null)}
    >
      {Array.from({ length: 5 }, (_, index) => {
        const fill = starFill(index, display);
        return (
          <span
            key={index}
            className={`relative inline-flex ${interactive ? "cursor-pointer" : ""}`}
          >
            {interactive ? (
              <>
                <button
                  type="button"
                  className="absolute inset-y-0 left-0 z-10 w-1/2"
                  aria-label={`${index + 0.5} stars`}
                  onMouseEnter={() => setHoverValue(index + 0.5)}
                  onClick={() => pickStar(index, true)}
                />
                <button
                  type="button"
                  className="absolute inset-y-0 right-0 z-10 w-1/2"
                  aria-label={`${index + 1} stars`}
                  onMouseEnter={() => setHoverValue(index + 1)}
                  onClick={() => pickStar(index, false)}
                />
              </>
            ) : null}
            {fill === "half" ? (
              <StarHalfIcon
                size={size}
                weight="fill"
                className="text-foreground"
              />
            ) : (
              <StarIcon
                size={size}
                weight={fill === "full" ? "fill" : "regular"}
                className={fill === "full" ? "text-foreground" : "text-muted/60"}
              />
            )}
          </span>
        );
      })}
    </span>
  );
}

export function formatStarAverage(averageTenths: number | null): string | null {
  if (averageTenths === null) {
    return null;
  }
  const stars = averageTenths / 2;
  return stars.toFixed(1);
}

export function ratingToStars(rating: number | null): number | null {
  if (rating === null) {
    return null;
  }
  return rating / 2;
}
