"use client";

import { useCallback, useEffect, useRef } from "react";

/**
 * Loads the next page when a sentinel scrolls into view.
 *
 * Returns a ref to put on an element at the END of the list. An
 * `IntersectionObserver` on a callback ref rather than an effect, so it
 * attaches the moment the node exists and detaches when it leaves — no cleanup
 * to get wrong when the list re-renders, and no scroll handler firing on every
 * pixel.
 *
 * `rootMargin` starts the fetch before the sentinel is actually visible, so the
 * next rows are usually there by the time the scroll reaches them.
 */
export function useInfiniteScroll(options: {
  hasMore: boolean;
  loading: boolean;
  onLoadMore: () => void;
  /** How far ahead of the bottom to start loading. */
  rootMargin?: string;
}): (node: HTMLElement | null) => void {
  const { hasMore, loading, onLoadMore, rootMargin = "400px" } = options;

  const observer = useRef<IntersectionObserver | null>(null);

  /**
   * The latest values, read inside the observer callback.
   *
   * They live in a ref so the observer survives a re-render: `onLoadMore` is an
   * inline arrow at every call site, so depending on it would tear down and
   * rebuild the observer on every keystroke in the search box.
   */
  const state = useRef({ hasMore, loading, onLoadMore });
  useEffect(() => {
    state.current = { hasMore, loading, onLoadMore };
  });

  return useCallback(
    (node: HTMLElement | null) => {
      observer.current?.disconnect();
      if (node === null) return;

      observer.current = new IntersectionObserver(
        (entries) => {
          const { hasMore: more, loading: busy, onLoadMore: load } = state.current;
          if (entries[0]?.isIntersecting && more && !busy) load();
        },
        { rootMargin },
      );
      observer.current.observe(node);
    },
    [rootMargin],
  );
}
