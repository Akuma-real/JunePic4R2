"use client";

import { useEffect, useRef } from "react";
import { Fancybox } from "@fancyapps/ui";

type FancyboxShowParams = Parameters<(typeof Fancybox)["show"]>;
type FancyboxSlides = NonNullable<FancyboxShowParams[0]>;
type FancyboxOptions = NonNullable<FancyboxShowParams[1]>;
type FancyboxInstance = ReturnType<(typeof Fancybox)["show"]>;
type CarouselChangePayload = Parameters<
  NonNullable<NonNullable<FancyboxOptions["on"]>["Carousel.change"]>
>[0];

export interface LightboxImageItem {
  src: string;
  alt?: string;
  width?: number | null;
  height?: number | null;
}

interface LightboxProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  images: LightboxImageItem[];
  index?: number;
  onIndexChange?: (idx: number) => void;
  triggerEl?: HTMLElement | null;
  maxScale?: number;
}

export function Lightbox({
  open,
  onOpenChange,
  images,
  index = 0,
  onIndexChange,
  triggerEl,
  maxScale = 4,
}: LightboxProps) {
  const instanceRef = useRef<FancyboxInstance | null>(null);

  const openFancybox = (startIndex: number) => {
    if (!images.length) return;

    const slides: FancyboxSlides = images.map((image, idx) => {
      const slide: FancyboxSlides[number] = {
        src: image.src,
        type: "image",
        width: image.width ?? undefined,
        height: image.height ?? undefined,
        thumb: image.src,
        caption: image.alt,
      };

      if (idx === startIndex && triggerEl instanceof HTMLImageElement) {
        slide.thumbEl = triggerEl;
      }

      return slide;
    });

    const inst = Fancybox.show(
      slides,
      {
        startIndex,
        triggerEl: triggerEl ?? undefined,
        dragToClose: true,
        animated: true,
        placeFocusBack: true,
        Images: {
          zoom: true,
          zoomOpacity: "auto",
          Panzoom: {
            ...(maxScale ? { maxScale } : {}),
          },
        },
        on: {
          shouldClose: () => {
            if (typeof document !== "undefined") {
              const active = document.activeElement;
              if (active instanceof HTMLElement) {
                active.blur();
              }
            }
          },
          close: () => onOpenChange(false),
          "Carousel.change": (payload: CarouselChangePayload) => {
            const idx = payload?.Carousel?.page ?? 0;
            onIndexChange?.(idx);
          },
        },
      } satisfies FancyboxOptions
    );

    instanceRef.current = inst;
  };

  useEffect(() => {
    if (open) {
      instanceRef.current?.close?.();
      openFancybox(index);
      return () => {
        instanceRef.current?.close?.();
        instanceRef.current = null;
      };
    } else {
      instanceRef.current?.close?.();
      instanceRef.current = null;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  useEffect(() => {
    if (open && instanceRef.current) {
      const carousel = instanceRef.current?.carousel;
      carousel?.slideTo?.(index, { friction: 0 });
    }
  }, [index, open]);

  return null;
}

export default Lightbox;
