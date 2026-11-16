/**
 * Public Author and Community Privacy Mapper (SRS FR-4.1, 4.2, 5.4).
 *
 * WHY:
 * 1. Privacy By Design: The Two-Layer Identity Architecture mandates that community
 *    posts, comments, and reactions expose ONLY pseudonymous public profile fields
 *    (`anonymousHandle`, `avatarUrl`). Real identity fields (`VerifiedIdentity`,
 *    `firstName`, `lastName`, `phone`, `email`, `userId`, `authorId`) must NEVER leak.
 * 2. Tombstone Handling: When a user deletes their account, database `onDelete: SetNull`
 *    nulls the `authorId` to preserve discussion context. The mapper renders this
 *    consistently as `{ handle: "[Deleted User]", avatarUrl: null }`.
 * 3. Single Source of Truth: Centralizing row-to-DTO transformation prevents accidental
 *    field leakage across feeds, single-post fetches, and comment threads.
 */

export interface PublicAuthorDTO {
  handle: string;
  avatarUrl: string | null;
}

export interface PostResponseDTO {
  id: string;
  topicId: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: Date;
  author: PublicAuthorDTO;
  isMine: boolean;
  reactedByMe: boolean;
  supportCount: number;
  commentCount: number;
}

export interface CommentResponseDTO {
  id: string;
  postId: string;
  content: string;
  createdAt: Date;
  author: PublicAuthorDTO;
  isMine: boolean;
}

export interface TopicResponseDTO {
  id: string;
  slug: string;
  name: string;
  description: string | null;
  postCount: number;
}

/**
 * Raw Prisma author selection shape.
 * Enforces that only profile fields are queried from the user table.
 */
export interface RawAuthorProfile {
  profile: {
    anonymousHandle: string;
    avatarUrl: string | null;
  } | null;
}

export interface RawPostRow {
  id: string;
  authorId: string | null;
  topicId: string;
  title: string;
  content: string;
  isPinned: boolean;
  createdAt: Date;
  author?: RawAuthorProfile | null;
  _count?: {
    reactions?: number;
    comments?: number;
  };
}

export interface RawCommentRow {
  id: string;
  postId: string;
  authorId: string | null;
  content: string;
  createdAt: Date;
  author?: RawAuthorProfile | null;
}

/**
 * Maps an author relation to a sanitized public author DTO.
 * Guarantees that only `{ handle, avatarUrl }` is returned, never bio, email, or any ID.
 */
export function mapAuthor(author?: RawAuthorProfile | null): PublicAuthorDTO {
  if (!author || !author.profile) {
    return {
      handle: '[Deleted User]',
      avatarUrl: null,
    };
  }

  return {
    handle: author.profile.anonymousHandle,
    avatarUrl: author.profile.avatarUrl ?? null,
  };
}

/**
 * Maps a database Post row into a public PostResponseDTO.
 * Computes `isMine` server-side and completely omits `authorId` and all private user keys.
 */
export function mapPost(
  row: RawPostRow,
  currentUserId: string,
  options: {
    reactedByMe?: boolean;
    supportCount?: number;
    commentCount?: number;
  } = {}
): PostResponseDTO {
  const isMine = Boolean(row.authorId && row.authorId === currentUserId);
  const supportCount = options.supportCount ?? row._count?.reactions ?? 0;
  const commentCount = options.commentCount ?? row._count?.comments ?? 0;
  const reactedByMe = options.reactedByMe ?? false;

  return {
    id: row.id,
    topicId: row.topicId,
    title: row.title,
    content: row.content,
    isPinned: row.isPinned,
    createdAt: row.createdAt,
    author: mapAuthor(row.author),
    isMine,
    reactedByMe,
    supportCount,
    commentCount,
  };
}

/**
 * Maps a database Comment row into a public CommentResponseDTO.
 * Computes `isMine` server-side and completely omits `authorId` and all private user keys.
 */
export function mapComment(
  row: RawCommentRow,
  currentUserId: string
): CommentResponseDTO {
  const isMine = Boolean(row.authorId && row.authorId === currentUserId);

  return {
    id: row.id,
    postId: row.postId,
    content: row.content,
    createdAt: row.createdAt,
    author: mapAuthor(row.author),
    isMine,
  };
}
