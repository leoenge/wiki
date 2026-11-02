import { Trash } from "@phosphor-icons/react";
import { useEffect, useRef, useState } from "react";

const REVEAL_WIDTH = 56;

type SwipeToDeleteRowProps = {
  elementId: string;
  openElementId: string | null;
  onOpenChange: (elementId: string | null) => void;
  onDelete: () => void;
  children: React.ReactNode;
};

function isSwipeBlockedTarget(target: EventTarget | null): boolean {
  if (!(target instanceof HTMLElement)) {
    return false;
  }
  return Boolean(target.closest("textarea, [data-swipe-exclude]"));
}

export function SwipeToDeleteRow({
  elementId,
  openElementId,
  onOpenChange,
  onDelete,
  children,
}: SwipeToDeleteRowProps) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startOffset: number;
  } | null>(null);

  const isOpen = openElementId === elementId;

  useEffect(() => {
    if (!isOpen) {
      setOffset(0);
    } else {
      setOffset(-REVEAL_WIDTH);
    }
  }, [isOpen]);

  function onPointerDown(event: React.PointerEvent<HTMLDivElement>) {
    if (isSwipeBlockedTarget(event.target)) {
      return;
    }

    dragRef.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startOffset: isOpen ? -REVEAL_WIDTH : 0,
    };
    setDragging(true);
    event.currentTarget.setPointerCapture(event.pointerId);
  }

  function onPointerMove(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    const deltaX = event.clientX - drag.startX;
    const next = Math.min(0, Math.max(-REVEAL_WIDTH, drag.startOffset + deltaX));
    setOffset(next);
  }

  function onPointerUp(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    const deltaX = event.clientX - drag.startX;
    const finalOffset = Math.min(
      0,
      Math.max(-REVEAL_WIDTH, drag.startOffset + deltaX),
    );
    setOffset(finalOffset);

    if (finalOffset < -REVEAL_WIDTH / 2) {
      onOpenChange(elementId);
    } else {
      onOpenChange(null);
    }
    dragRef.current = null;
    setDragging(false);
  }

  function onPointerCancel(event: React.PointerEvent<HTMLDivElement>) {
    const drag = dragRef.current;
    if (!drag || drag.pointerId !== event.pointerId) {
      return;
    }

    if (event.currentTarget.hasPointerCapture(event.pointerId)) {
      event.currentTarget.releasePointerCapture(event.pointerId);
    }

    setOffset(isOpen ? -REVEAL_WIDTH : 0);
    dragRef.current = null;
    setDragging(false);
  }

  return (
    <div className="relative overflow-hidden">
      <button
        type="button"
        onClick={() => {
          onOpenChange(null);
          onDelete();
        }}
        className="bg-red-600/90 text-background absolute inset-y-0 right-0 flex w-14 items-center justify-center"
        aria-label="Remove element"
      >
        <Trash size={22} weight="bold" />
      </button>
      <div
        className="bg-background relative touch-pan-y"
        style={{
          transform: `translateX(${offset}px)`,
          transition: dragging ? undefined : "transform 180ms ease-out",
        }}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerCancel}
      >
        {children}
      </div>
    </div>
  );
}
