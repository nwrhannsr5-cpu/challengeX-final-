import { createFileRoute } from "@tanstack/react-router";
import { formatDistanceToNow } from "date-fns";
import {
  Heart,
  ImagePlus,
  Loader2,
  MessageCircle,
  RefreshCw,
  Search,
  Send,
  Trash2,
  X,
} from "lucide-react";
import { useEffect, useRef, useState, type ChangeEvent, type ReactNode, type RefObject } from "react";

import { useInfiniteFeed } from "@/hooks/useInfiniteFeed";
import { useAuth } from "@/lib/auth";
import {
  addComment,
  createPost,
  deletePost,
  normalizeProfile,
  searchSocial,
  toggleLike,
  type FeedPost,
  type FeedSearchResults,
  type ProfileLite,
} from "@/services/social";

export const Route = createFileRoute("/feed")({
  head: () => ({ meta: [{ title: "Feed - ChallengeX" }] }),
  component: FeedPage,
});

function FeedPage() {
  const { user, profile } = useAuth();
  const [selectedPerson, setSelectedPerson] = useState<ProfileLite | null>(null);
  const {
    posts,
    setPosts,
    initialLoading,
    moreLoading,
    hasMore,
    error,
    setError,
    load,
  } = useInfiniteFeed(selectedPerson?.id ?? null);
  const [content, setContent] = useState("");
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [posting, setPosting] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searching, setSearching] = useState(false);
  const [searchResults, setSearchResults] = useState<FeedSearchResults>({ people: [], posts: [] });
  const sentinelRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const displayName =
    profile?.username || profile?.full_name || profile?.name || user?.email?.split("@")[0] || "You";
  const canPost = Boolean(content.trim() || image);

  useEffect(() => {
    if (!image) {
      setPreview(null);
      return;
    }

    const url = URL.createObjectURL(image);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [image]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel || initialLoading || moreLoading || !hasMore) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) void load();
      },
      { rootMargin: "520px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore, initialLoading, load, moreLoading]);

  useEffect(() => {
    const query = searchQuery.trim();

    if (query.length < 2) {
      setSearchResults({ people: [], posts: [] });
      setSearching(false);
      return;
    }

    const timer = window.setTimeout(async () => {
      setSearching(true);
      try {
        setSearchResults(await searchSocial(query));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Search failed.");
      } finally {
        setSearching(false);
      }
    }, 260);

    return () => window.clearTimeout(timer);
  }, [searchQuery, setError]);

  const resetComposer = () => {
    setContent("");
    setImage(null);
    if (fileRef.current) fileRef.current.value = "";
  };

  const submitPost = async () => {
    if (!user || !canPost) return;

    setPosting(true);
    setError(null);

    try {
      await createPost({ userId: user.id, content, image });
      resetComposer();
      setSelectedPerson(null);
      await load({ reset: true });
      window.scrollTo({ top: 0, behavior: "smooth" });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not create post.");
    } finally {
      setPosting(false);
    }
  };

  const refresh = async () => {
    await load({ reset: true });
    window.scrollTo({ top: 0, behavior: "smooth" });
  };

  const filterByPerson = (person: ProfileLite) => {
    setSelectedPerson(person);
    setSearchQuery("");
    setSearchResults({ people: [], posts: [] });
  };

  const clearPersonFilter = () => {
    setSelectedPerson(null);
  };

  return (
    <div className="app-page max-w-5xl space-y-5 pr-20">
      <header className="animate-in fade-in slide-in-from-bottom-2 duration-500">
        <div className="mb-2 inline-flex rounded-full bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
          ChallengeX Social
        </div>
        <h1 className="font-display text-4xl font-bold">Feed</h1>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          A professional social stream for progress, wins, proof photos, and challenge updates.
        </p>
      </header>

      <SearchPanel
        query={searchQuery}
        searching={searching}
        results={searchResults}
        selectedPerson={selectedPerson}
        onQueryChange={setSearchQuery}
        onClearQuery={() => {
          setSearchQuery("");
          setSearchResults({ people: [], posts: [] });
        }}
        onSelectPerson={filterByPerson}
        onClearPerson={clearPersonFilter}
      />

      <CreatePostCard
        displayName={displayName}
        avatarUrl={profile?.avatar_url ?? null}
        content={content}
        preview={preview}
        posting={posting}
        canPost={canPost}
        fileRef={fileRef}
        onContentChange={setContent}
        onImageChange={(event) => setImage(event.target.files?.[0] ?? null)}
        onRemoveImage={() => {
          setImage(null);
          if (fileRef.current) fileRef.current.value = "";
        }}
        onSubmit={() => void submitPost()}
      />

      {error && (
        <div className="surface-panel flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm text-destructive">
          <span>{error}</span>
          <button type="button" onClick={() => void refresh()} className="secondary-button px-3 py-1.5">
            <RefreshCw className="h-4 w-4" />
            Retry
          </button>
        </div>
      )}

      <section className="space-y-4" aria-live="polite">
        {initialLoading &&
          Array.from({ length: 4 }).map((_, index) => <PostSkeleton key={index} />)}

        {!initialLoading && posts.length === 0 && (
          <div className="surface-card grid min-h-64 place-items-center p-10 text-center">
            <ImagePlus className="mx-auto mb-3 h-8 w-8 text-primary" />
            <h2 className="font-display text-xl font-bold">No posts yet</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {selectedPerson ? "This person has not posted yet." : "Be the first to share a win."}
            </p>
          </div>
        )}

        {posts.map((post, index) => (
          <PostCard
            key={post.id}
            post={post}
            currentUserId={user?.id ?? null}
            delay={Math.min(index * 70, 360)}
            onLike={async () => {
              if (!user) return;
              const previous = posts;
              setPosts((current) =>
                current.map((item) =>
                  item.id === post.id
                    ? {
                        ...item,
                        liked_by_me: !item.liked_by_me,
                        like_count: item.like_count + (item.liked_by_me ? -1 : 1),
                      }
                    : item,
                ),
              );
              try {
                await toggleLike(post, user.id);
              } catch (err) {
                setPosts(previous);
                setError(err instanceof Error ? err.message : "Could not update reaction.");
              }
            }}
            onComment={async (comment) => {
              if (!user) return;
              try {
                await addComment({ postId: post.id, userId: user.id, content: comment });
                await load({ reset: true });
              } catch (err) {
                setError(err instanceof Error ? err.message : "Could not add comment.");
              }
            }}
            onDelete={async () => {
              if (!user) return;
              const previous = posts;
              setPosts((current) => current.filter((item) => item.id !== post.id));
              try {
                await deletePost(post.id, user.id);
              } catch (err) {
                setPosts(previous);
                setError(err instanceof Error ? err.message : "Could not delete post.");
              }
            }}
          />
        ))}

        {moreLoading && (
          <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading more posts
          </div>
        )}

        {!initialLoading && !hasMore && posts.length > 0 && (
          <div className="py-6 text-center text-xs text-muted-foreground">You are all caught up.</div>
        )}

        <div ref={sentinelRef} className="h-8" />
      </section>
    </div>
  );
}

function SearchPanel({
  query,
  searching,
  results,
  selectedPerson,
  onQueryChange,
  onClearQuery,
  onSelectPerson,
  onClearPerson,
}: {
  query: string;
  searching: boolean;
  results: FeedSearchResults;
  selectedPerson: ProfileLite | null;
  onQueryChange: (value: string) => void;
  onClearQuery: () => void;
  onSelectPerson: (person: ProfileLite) => void;
  onClearPerson: () => void;
}) {
  const showResults = query.trim().length >= 2 || searching;

  return (
    <section className="surface-panel sticky top-4 z-30 space-y-3 p-3">
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <input
          value={query}
          onChange={(event) => onQueryChange(event.target.value)}
          placeholder="Search people and posts"
          className="control-input h-12 pl-10 pr-10"
        />
        {query && (
          <button
            type="button"
            onClick={onClearQuery}
            className="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
            aria-label="Clear search"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {selectedPerson && (
        <div className="flex flex-wrap items-center justify-between gap-2">
          <span className="rounded-full border border-primary/30 bg-primary/15 px-3 py-1 text-xs font-bold text-primary">
            Showing {selectedPerson.username ?? "selected person"}
          </span>
          <button type="button" onClick={onClearPerson} className="secondary-button px-3 py-1.5 text-xs">
            Show all posts
          </button>
        </div>
      )}

      {showResults && (
        <div className="grid gap-3 rounded-[12px] border border-border bg-card/80 p-3">
          {searching ? (
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" />
              Searching
            </div>
          ) : (
            <>
              <SearchSection title="People">
                {results.people.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-muted-foreground">No people found.</p>
                ) : (
                  results.people.map((person) => (
                    <button
                      key={person.id}
                      type="button"
                      onClick={() => onSelectPerson(person)}
                      className="flex w-full items-center gap-3 rounded-[10px] px-2 py-2 text-left transition-colors hover:bg-accent"
                    >
                      <Avatar name={person.username ?? "User"} avatarUrl={person.avatar_url} />
                      <span className="font-display text-sm font-bold">
                        {person.username ?? "User"}
                      </span>
                    </button>
                  ))
                )}
              </SearchSection>

              <SearchSection title="Posts">
                {results.posts.length === 0 ? (
                  <p className="px-2 py-1 text-sm text-muted-foreground">No matching posts.</p>
                ) : (
                  results.posts.map((post) => {
                    const author = normalizeProfile(post.profiles);
                    return (
                      <div key={post.id} className="rounded-[10px] px-2 py-2 hover:bg-accent">
                        <div className="mb-1 text-xs font-bold text-muted-foreground">
                          {author?.username ?? "Challenger"} - {formatTime(post.created_at)}
                        </div>
                        <p className="line-clamp-2 text-sm">{post.content || "Image post"}</p>
                      </div>
                    );
                  })
                )}
              </SearchSection>
            </>
          )}
        </div>
      )}
    </section>
  );
}

function SearchSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div>
      <div className="mb-1 text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
        {title}
      </div>
      {children}
    </div>
  );
}

function CreatePostCard({
  displayName,
  avatarUrl,
  content,
  preview,
  posting,
  canPost,
  fileRef,
  onContentChange,
  onImageChange,
  onRemoveImage,
  onSubmit,
}: {
  displayName: string;
  avatarUrl: string | null;
  content: string;
  preview: string | null;
  posting: boolean;
  canPost: boolean;
  fileRef: RefObject<HTMLInputElement | null>;
  onContentChange: (value: string) => void;
  onImageChange: (event: ChangeEvent<HTMLInputElement>) => void;
  onRemoveImage: () => void;
  onSubmit: () => void;
}) {
  return (
    <section className="surface-card animate-in fade-in slide-in-from-bottom-2 p-4 duration-500">
      <div className="mb-3 flex items-center gap-3">
        <Avatar name={displayName} avatarUrl={avatarUrl} />
        <div>
          <h2 className="font-display font-bold">{displayName}</h2>
          <p className="text-xs text-muted-foreground">Share a challenge update</p>
        </div>
      </div>

      <textarea
        value={content}
        onChange={(event) => onContentChange(event.target.value)}
        placeholder="What are you working on today?"
        className="control-input min-h-28 resize-none p-3"
        maxLength={1200}
      />

      {preview && (
        <div className="relative mt-3 overflow-hidden rounded-[12px] border border-border">
          <img src={preview} alt="Upload preview" className="max-h-[360px] w-full object-cover" />
          <button
            type="button"
            onClick={onRemoveImage}
            className="absolute right-3 top-3 grid h-9 w-9 place-items-center rounded-full bg-black/70 text-white"
            aria-label="Remove image"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      <div className="mt-3 flex flex-wrap items-center justify-between gap-3">
        <input
          ref={fileRef}
          id="post-image-upload"
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={onImageChange}
        />
        <label htmlFor="post-image-upload" className="secondary-button cursor-pointer px-4 py-2 text-sm">
          <ImagePlus className="h-4 w-4" />
          Add image
        </label>

        <button
          type="button"
          onClick={onSubmit}
          disabled={!canPost || posting}
          className="primary-button px-5 py-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {posting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          Post
        </button>
      </div>
    </section>
  );
}

function PostCard({
  post,
  currentUserId,
  delay,
  onLike,
  onComment,
  onDelete,
}: {
  post: FeedPost;
  currentUserId: string | null;
  delay: number;
  onLike: () => void;
  onComment: (comment: string) => void;
  onDelete: () => void;
}) {
  const [commentsOpen, setCommentsOpen] = useState(false);
  const [comment, setComment] = useState("");
  const author = normalizeProfile(post.profiles);
  const username = author?.username ?? "Challenger";
  const isOwner = currentUserId === post.user_id;

  return (
    <article
      className="surface-card animate-in fade-in slide-in-from-bottom-2 overflow-hidden transition-all duration-500 hover:-translate-y-0.5 hover:border-primary/40"
      style={{ animationDelay: `${delay}ms`, animationFillMode: "both" }}
    >
      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="flex min-w-0 items-center gap-3">
            <Avatar name={username} avatarUrl={author?.avatar_url ?? null} />
            <div className="min-w-0">
              <h2 className="truncate font-display font-bold">{username}</h2>
              <time className="text-xs text-muted-foreground" dateTime={post.created_at}>
                {formatTime(post.created_at)}
              </time>
            </div>
          </div>

          {isOwner && (
            <button
              type="button"
              onClick={onDelete}
              className="grid h-9 w-9 place-items-center rounded-full text-destructive transition-colors hover:bg-destructive/10"
              aria-label="Delete post"
              title="Delete post"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          )}
        </div>

        {post.content && (
          <p className="mt-4 whitespace-pre-wrap break-words text-[15px] leading-7">{post.content}</p>
        )}
      </div>

      {post.image_url && (
        <img
          src={post.image_url}
          alt={`${username}'s post`}
          className="max-h-[760px] w-full object-cover"
          loading="lazy"
        />
      )}

      <div className="border-t border-border px-5 py-3">
        <div className="mb-3 flex items-center justify-between text-xs text-muted-foreground">
          <span>{post.like_count} likes</span>
          <span>{post.comments.length} comments</span>
        </div>
        <div className="grid grid-cols-2 gap-2">
          <button
            type="button"
            onClick={onLike}
            className={`secondary-button py-2 text-sm ${
              post.liked_by_me ? "border-primary/40 bg-primary/15 text-primary" : ""
            }`}
          >
            <Heart className={`h-4 w-4 ${post.liked_by_me ? "fill-current" : ""}`} />
            Like
          </button>
          <button
            type="button"
            onClick={() => setCommentsOpen((open) => !open)}
            className="secondary-button py-2 text-sm"
          >
            <MessageCircle className="h-4 w-4" />
            Comment
          </button>
        </div>
      </div>

      {commentsOpen && (
        <div className="space-y-3 border-t border-border bg-muted/35 p-5">
          {post.comments.length === 0 ? (
            <p className="text-sm text-muted-foreground">No comments yet.</p>
          ) : (
            post.comments.map((item) => {
              const commenter = normalizeProfile(item.profiles);
              return (
                <div key={item.id} className="flex gap-3">
                  <Avatar name={commenter?.username ?? "User"} avatarUrl={commenter?.avatar_url ?? null} size="sm" />
                  <div className="rounded-[12px] bg-card px-3 py-2">
                    <div className="text-xs font-bold">{commenter?.username ?? "User"}</div>
                    <p className="text-sm">{item.content}</p>
                  </div>
                </div>
              );
            })
          )}

          <form
            className="flex gap-2"
            onSubmit={(event) => {
              event.preventDefault();
              if (!comment.trim()) return;
              onComment(comment.trim());
              setComment("");
            }}
          >
            <input
              value={comment}
              onChange={(event) => setComment(event.target.value)}
              placeholder="Write a comment"
              className="control-input h-10 px-3"
            />
            <button type="submit" className="primary-button h-10 w-10" aria-label="Send comment">
              <Send className="h-4 w-4" />
            </button>
          </form>
        </div>
      )}
    </article>
  );
}

function Avatar({
  name,
  avatarUrl,
  size = "md",
}: {
  name: string;
  avatarUrl: string | null;
  size?: "sm" | "md";
}) {
  const sizeClass = size === "sm" ? "h-8 w-8 text-xs" : "h-11 w-11 text-base";

  if (avatarUrl) {
    return <img src={avatarUrl} alt={name} className={`${sizeClass} shrink-0 rounded-full object-cover`} />;
  }

  return (
    <div className={`${sizeClass} grid shrink-0 place-items-center rounded-full bg-primary font-display font-bold text-primary-foreground`}>
      {name.trim()[0]?.toUpperCase() || "?"}
    </div>
  );
}

function PostSkeleton() {
  return (
    <div className="surface-card animate-pulse p-5">
      <div className="flex items-center gap-3">
        <div className="h-11 w-11 rounded-full bg-primary/15" />
        <div className="space-y-2">
          <div className="h-4 w-36 rounded bg-primary/15" />
          <div className="h-3 w-24 rounded bg-primary/10" />
        </div>
      </div>
      <div className="mt-5 space-y-2">
        <div className="h-4 rounded bg-primary/10" />
        <div className="h-4 w-4/5 rounded bg-primary/10" />
      </div>
      <div className="mt-5 aspect-[4/3] rounded-[12px] bg-primary/10" />
    </div>
  );
}

function formatTime(value: string) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return formatDistanceToNow(date, { addSuffix: true });
}
