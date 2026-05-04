import { useCallback, useEffect, useRef, useState } from "react";

import { fetchFeedPosts, type FeedPost } from "@/services/social";

const PAGE_SIZE = 8;

export function useInfiniteFeed(userId?: string | null) {
  const [posts, setPosts] = useState<FeedPost[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [moreLoading, setMoreLoading] = useState(false);
  const [hasMore, setHasMore] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const offsetRef = useRef(0);
  const loadingRef = useRef(false);

  const load = useCallback(
    async ({ reset = false }: { reset?: boolean } = {}) => {
      if (loadingRef.current) return;
      loadingRef.current = true;
      setError(null);

      if (reset) {
        offsetRef.current = 0;
        setPosts([]);
        setHasMore(true);
        setInitialLoading(true);
      } else {
        setMoreLoading(true);
      }

      const from = reset ? 0 : offsetRef.current;
      const to = from + PAGE_SIZE - 1;

      try {
        const nextPosts = await fetchFeedPosts({ from, to, userId });
        setPosts((current) => (reset ? nextPosts : [...current, ...nextPosts]));
        offsetRef.current = from + nextPosts.length;
        setHasMore(nextPosts.length === PAGE_SIZE);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Could not load feed.");
      } finally {
        loadingRef.current = false;
        setInitialLoading(false);
        setMoreLoading(false);
      }
    },
    [userId],
  );

  useEffect(() => {
    void load({ reset: true });
  }, [load]);

  return {
    posts,
    setPosts,
    initialLoading,
    moreLoading,
    hasMore,
    error,
    setError,
    load,
  };
}
