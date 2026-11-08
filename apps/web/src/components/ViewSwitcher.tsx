import {
  type ReactNode,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from "react";

type ViewSwitcherProps = {
  activeView: string;
  direction: "forward" | "back";
  views: Record<string, ReactNode>;
  className?: string;
};

const TRANSITION_MS = 250;

export function ViewSwitcher({
  activeView,
  direction,
  views,
  className,
}: ViewSwitcherProps) {
  const reduceMotion = usePrefersReducedMotion();
  const heightRef = useRef<HTMLDivElement>(null);
  const measureRef = useRef<HTMLDivElement>(null);

  const [displayedView, setDisplayedView] = useState(activeView);
  const [previousView, setPreviousView] = useState<string | null>(null);
  const [animating, setAnimating] = useState(false);
  const [height, setHeight] = useState<number | null>(null);

  useEffect(() => {
    if (activeView === displayedView) {
      return;
    }
    setPreviousView(displayedView);
    setDisplayedView(activeView);
    setAnimating(!reduceMotion);
  }, [activeView, displayedView, reduceMotion]);

  useEffect(() => {
    if (!animating) {
      setPreviousView(null);
      return;
    }
    const timer = window.setTimeout(() => {
      setAnimating(false);
      setPreviousView(null);
    }, TRANSITION_MS);
    return () => window.clearTimeout(timer);
  }, [animating, displayedView]);

  useLayoutEffect(() => {
    const node = measureRef.current;
    if (!node) {
      return;
    }

    const measure = () => setHeight(node.offsetHeight);
    measure();

    const observer = new ResizeObserver(measure);
    observer.observe(node);
    return () => observer.disconnect();
  }, [displayedView, previousView, animating]);

  useEffect(() => {
    if (animating) {
      return;
    }
    const node = measureRef.current;
    if (!node) {
      return;
    }
    const focusable = node.querySelector<HTMLElement>(
      'input, button, textarea, select, [tabindex]:not([tabindex="-1"])',
    );
    focusable?.focus();
  }, [displayedView, animating]);

  const incomingClass = reduceMotion
    ? animating
      ? "view-switcher-fade-in"
      : ""
    : direction === "forward"
      ? "view-switcher-from-right"
      : "view-switcher-from-left";

  const outgoingClass = reduceMotion
    ? "view-switcher-fade-out"
    : direction === "forward"
      ? "view-switcher-to-left"
      : "view-switcher-to-right";

  return (
    <div
      ref={heightRef}
      className={className}
      style={{
        height: height === null ? undefined : height,
        transition:
          reduceMotion || height === null
            ? undefined
            : `height ${TRANSITION_MS}ms cubic-bezier(0, 0, 0.2, 1)`,
        overflow: "hidden",
      }}
    >
      <div className="relative">
        {animating && previousView ? (
          <div
            className={`view-switcher-layer ${outgoingClass}`}
            aria-hidden
          >
            {views[previousView]}
          </div>
        ) : null}
        <div
          ref={measureRef}
          className={[
            animating ? "view-switcher-layer" : "",
            animating ? incomingClass : "",
          ]
            .filter(Boolean)
            .join(" ")}
        >
          {views[displayedView]}
        </div>
      </div>
    </div>
  );
}

function usePrefersReducedMotion() {
  const [reduceMotion, setReduceMotion] = useState(() => {
    if (typeof window === "undefined") {
      return false;
    }
    return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  });

  useEffect(() => {
    const media = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduceMotion(media.matches);
    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return reduceMotion;
}
