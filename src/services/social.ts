import { supabase } from "@/lib/supabase";

export interface ProfileLite {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

export interface FeedPost {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  profiles: ProfileLite | ProfileLite[] | null;
  like_count: number;
  liked_by_me: boolean;
  comments: FeedComment[];
}

export interface FeedComment {
  id: string;
  post_id: string;
  user_id: string;
  content: string;
  created_at: string;
  profiles: ProfileLite | ProfileLite[] | null;
}

export interface SearchPerson {
  id: string;
  username: string | null;
  avatar_url: string | null;
}

export interface SearchPost {
  id: string;
  user_id: string;
  content: string | null;
  image_url: string | null;
  created_at: string;
  profiles: ProfileLite | ProfileLite[] | null;
}

export interface FeedSearchResults {
  people: SearchPerson[];
  posts: SearchPost[];
}

const POST_SELECT = "id, user_id, content, image_url, created_at, profiles(id, username, avatar_url)";
const COMMENT_SELECT = "id, post_id, user_id, content, created_at, profiles(id, username, avatar_url)";

export async function fetchFeedPosts({
  from,
  to,
  userId,
}: {
  from: number;
  to: number;
  userId?: string | null;
}) {
  let query = supabase.from("posts").select(POST_SELECT).order("created_at", { ascending: false });

  if (userId) query = query.eq("user_id", userId);

  const { data, error } = await query.range(from, to);
  if (error) throw error;

  return hydratePosts((data ?? []) as unknown as Omit<FeedPost, "like_count" | "liked_by_me" | "comments">[]);
}

export async function hydratePosts(
  posts: Omit<FeedPost, "like_count" | "liked_by_me" | "comments">[],
) {
  if (posts.length === 0) return [] as FeedPost[];

  const [{ data: authData }, reactionsResult, commentsResult] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("reactions").select("id, user_id, post_id, type").in(
      "post_id",
      posts.map((post) => post.id),
    ),
    supabase
      .from("comments")
      .select(COMMENT_SELECT)
      .in(
        "post_id",
        posts.map((post) => post.id),
      )
      .order("created_at", { ascending: true }),
  ]);

  if (reactionsResult.error) throw reactionsResult.error;
  if (commentsResult.error) throw commentsResult.error;

  const currentUserId = authData.user?.id ?? null;
  const reactions = (reactionsResult.data ?? []) as {
    id: string;
    user_id: string;
    post_id: string;
    type: string;
  }[];
  const comments = (commentsResult.data ?? []) as unknown as FeedComment[];

  return posts.map((post) => {
    const postReactions = reactions.filter((reaction) => reaction.post_id === post.id);
    return {
      ...post,
      like_count: postReactions.length,
      liked_by_me: currentUserId
        ? postReactions.some((reaction) => reaction.user_id === currentUserId)
        : false,
      comments: comments.filter((comment) => comment.post_id === post.id),
    };
  });
}

export async function createPost({
  userId,
  content,
  image,
}: {
  userId: string;
  content: string;
  image: File | null;
}) {
  let imageUrl: string | null = null;

  if (image) {
    const extension = image.name.split(".").pop()?.toLowerCase() || "jpg";
    const fileName = `${userId}/${crypto.randomUUID?.() ?? Date.now()}.${extension}`;
    const { error: uploadError } = await supabase.storage.from("posts").upload(fileName, image);
    if (uploadError) throw uploadError;

    const { data } = supabase.storage.from("posts").getPublicUrl(fileName);
    imageUrl = data.publicUrl;
  }

  const { error } = await supabase.from("posts").insert({
    user_id: userId,
    content: content.trim() || null,
    image_url: imageUrl,
  });

  if (error) throw error;
}

export async function deletePost(postId: string, userId: string) {
  const { error } = await supabase.from("posts").delete().eq("id", postId).eq("user_id", userId);
  if (error) throw error;
}

export async function toggleLike(post: FeedPost, userId: string) {
  if (post.liked_by_me) {
    const { error } = await supabase
      .from("reactions")
      .delete()
      .eq("post_id", post.id)
      .eq("user_id", userId);
    if (error) throw error;
    return;
  }

  const { error } = await supabase.from("reactions").upsert(
    {
      post_id: post.id,
      user_id: userId,
      type: "like",
    },
    { onConflict: "post_id,user_id" },
  );

  if (error) throw error;
}

export async function addComment({
  postId,
  userId,
  content,
}: {
  postId: string;
  userId: string;
  content: string;
}) {
  const { error } = await supabase.from("comments").insert({
    post_id: postId,
    user_id: userId,
    content: content.trim(),
  });

  if (error) throw error;
}

export async function searchSocial(queryText: string): Promise<FeedSearchResults> {
  const normalized = queryText.trim().replace(/[,%()]/g, "");
  if (normalized.length < 2) return { people: [], posts: [] };

  const pattern = `%${normalized}%`;
  const [peopleResult, postsResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("id, username, avatar_url")
      .ilike("username", pattern)
      .order("username")
      .limit(8),
    supabase
      .from("posts")
      .select(POST_SELECT)
      .ilike("content", pattern)
      .order("created_at", { ascending: false })
      .limit(8),
  ]);

  if (peopleResult.error) throw peopleResult.error;
  if (postsResult.error) throw postsResult.error;

  return {
    people: (peopleResult.data ?? []) as SearchPerson[],
    posts: (postsResult.data ?? []) as unknown as SearchPost[],
  };
}

export function normalizeProfile(profile: ProfileLite | ProfileLite[] | null) {
  if (Array.isArray(profile)) return profile[0] ?? null;
  return profile;
}
