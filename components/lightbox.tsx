"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxImageItem {
  src: string;
  alt?: string;
  width?: number | null;
  height?: number | null;
}

export function Lightbox({
  open,
  onOpenChange,
  images,
  index = 0,
  onIndexChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: LightboxImageItem[];
  index?: number;
  onIndexChange?: (idx: number) => void;
}) {
  const [current, setCurrent] = useState(index);
  const [scale, setScale] = useState(1);
  const [dragging, setDragging] = useState(false);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const lastPoint = useRef<{ x: number; y: number } | null>(null);
  const touchStartRef = useRef<{ x: number; y: number; t: number } | null>(null);

  // keep current in sync when index prop changes
  useEffect(() => {
    setCurrent(index);
    setScale(1);
    setOffset({ x: 0, y: 0 });
  }, [index, open]);

  useEffect(() => {
    if (onIndexChange) onIndexChange(current);
  }, [current, onIndexChange]);

  const total = images.length;
  const img = images[current];

  // Preload neighbors for smoother navigation
  useEffect(() => {
    const neighbors = [current - 1, current + 1].filter(
      (i) => i >= 0 && i < total
    );
    neighbors.forEach((i) => {
      const pre = new Image();
      pre.src = images[i].src;
    });
  }, [current, images, total]);

  const go = useCallback(
    (dir: -1 | 1) => {
      if (total <= 1) return;
      setScale(1);
      setOffset({ x: 0, y: 0 });
      setCurrent((c) => {
        const n = c + dir;
        if (n < 0) return total - 1; // wrap
        if (n >= total) return 0;
        return n;
      });
    },
    [total]
  );

  // Keyboard support
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "ArrowRight" || e.key.toLowerCase() === "l") {
        e.preventDefault();
        go(1);
      } else if (e.key === "ArrowLeft" || e.key.toLowerCase() === "h") {
        e.preventDefault();
        go(-1);
      } else if (e.key.toLowerCase() === "0") {
        setScale(1);
        setOffset({ x: 0, y: 0 });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, open]);

  const onWheel = useCallback((e: React.WheelEvent) => {
    // Ctrl/trackpad pinch -> zoom; otherwise ignore to avoid scroll conflicts
    if (e.ctrlKey) {
      e.preventDefault();
      const next = Math.min(4, Math.max(1, scale + (e.deltaY > 0 ? -0.1 : 0.1)));
      setScale(next);
      if (next === 1) setOffset({ x: 0, y: 0 });
    }
  }, [scale]);

  const onDoubleClick = useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setScale((s) => {
      const next = s === 1 ? 2 : 1;
      if (next === 1) setOffset({ x: 0, y: 0 });
      return next;
    });
  }, []);

  const startDrag = useCallback((x: number, y: number) => {
    if (scale === 1) return;
    setDragging(true);
    lastPoint.current = { x, y };
  }, [scale]);

  const moveDrag = useCallback((x: number, y: number) => {
    if (!dragging || !lastPoint.current) return;
    const dx = x - lastPoint.current.x;
    const dy = y - lastPoint.current.y;
    lastPoint.current = { x, y };
    setOffset((o) => ({ x: o.x + dx, y: o.y + dy }));
  }, [dragging]);

  const endDrag = useCallback(() => {
    setDragging(false);
    lastPoint.current = null;
  }, []);

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    startDrag(e.clientX, e.clientY);
  }, [startDrag]);

  const onMouseMove = useCallback((e: React.MouseEvent) => {
    moveDrag(e.clientX, e.clientY);
  }, [moveDrag]);

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    touchStartRef.current = { x: t.clientX, y: t.clientY, t: Date.now() };
    startDrag(t.clientX, t.clientY);
  }, [startDrag]);

  const onTouchMove = useCallback((e: React.TouchEvent) => {
    const t = e.touches[0];
    moveDrag(t.clientX, t.clientY);
  }, [moveDrag]);

  const onTouchEnd = useCallback(() => {
    const st = touchStartRef.current;
    if (st) {
      const dt = Date.now() - st.t;
      const dx = (lastPoint.current?.x ?? st.x) - st.x;
      // quick swipe to navigate when not zoomed
      if (scale === 1 && dt < 300 && Math.abs(dx) > 40) {
        go(dx > 0 ? 1 : -1);
      }
    }
    touchStartRef.current = null;
    endDrag();
  }, [endDrag, go, scale]);

  const canPrev = total > 1;
  const canNext = total > 1;

  const imgStyle = useMemo(
    () => ({
      transform: `translate(${offset.x}px, ${offset.y}px) scale(${scale})`,
    }),
    [offset.x, offset.y, scale]
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        showCloseButton={false}
        className={cn(
          "fixed inset-0 m-0 p-0 w-screen h-screen max-w-none border-0 rounded-none bg-black/95 grid place-items-center",
          "data-[state=open]:zoom-in-95 data-[state=closed]:zoom-out-95"
        )}
      >
        {/* Close */}
        <button
          aria-label="close"
          className="absolute top-4 right-4 z-[60] inline-flex items-center justify-center rounded-xs bg-white/10 hover:bg-white/20 text-white p-2"
          onClick={() => onOpenChange(false)}
        >
          <X className="w-5 h-5" />
        </button>

        {/* Prev/Next */}
        {canPrev && (
          <button
            aria-label="prev"
            className="absolute left-4 top-1/2 -translate-y-1/2 z-[60] inline-flex items-center justify-center rounded-xs bg-white/10 hover:bg-white/20 text-white p-2"
            onClick={() => go(-1)}
          >
            <ChevronLeft className="w-6 h-6" />
          </button>
        )}
        {canNext && (
          <button
            aria-label="next"
            className="absolute right-4 top-1/2 -translate-y-1/2 z-[60] inline-flex items-center justify-center rounded-xs bg-white/10 hover:bg-white/20 text-white p-2"
            onClick={() => go(1)}
          >
            <ChevronRight className="w-6 h-6" />
          </button>
        )}

        {/* Counter */}
        <div className="absolute top-4 left-1/2 -translate-x-1/2 text-white/80 text-sm z-[60] select-none">
          {current + 1} / {total}
        </div>

        {/* Image area */}
        <div
          className={cn(
            "relative w-full h-full overflow-hidden touch-pan-y select-none cursor-zoom-in",
            scale > 1 && "cursor-grab"
          )}
          onDoubleClick={onDoubleClick}
          onWheel={onWheel}
          onMouseDown={onMouseDown}
          onMouseMove={onMouseMove}
          onMouseUp={endDrag}
          onMouseLeave={endDrag}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onClick={(e) => {
            // single click toggles controls? keep noop to allow double-click zoom
            e.stopPropagation();
          }}
        >
          {img && (
            <img
              src={img.src}
              alt={img.alt ?? "image"}
              draggable={false}
              className={cn(
                "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 max-w-none",
                // fit into viewport when not zoomed
                scale === 1 ? "max-w-[95vw] max-h-[90vh]" : ""
              )}
              style={imgStyle}
            />
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default Lightbox;

