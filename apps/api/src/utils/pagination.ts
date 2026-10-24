import { Query } from 'firebase-admin/firestore';

export interface PaginationParams {
  limit?: number;
  cursor?: string;
}

export interface PaginatedResult<T> {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
  totalCount?: number;
}

/**
 * Standard cursor-based pagination utility for Firestore collections.
 * Enforces bounded batch sizes (max 100) to optimize read costs.
 */
export async function paginateQuery<T extends { id: string }>(
  query: Query,
  params: PaginationParams,
  defaultLimit: number = 20,
  maxLimit: number = 100
): Promise<PaginatedResult<T>> {
  const limit = Math.min(Math.max(1, params.limit || defaultLimit), maxLimit);

  let paginatedQuery = query;

  if (params.cursor) {
    // If a cursor ID or timestamp is provided, fetch document snapshot to start after
    try {
      // In Firestore, if starting after a cursor document
      paginatedQuery = paginatedQuery.startAfter(params.cursor);
    } catch {
      // Fallback if cursor is invalid
    }
  }

  // Request limit + 1 to reliably detect hasMore without an extra count query
  paginatedQuery = paginatedQuery.limit(limit + 1);

  const snapshot = await paginatedQuery.get();
  const docs = snapshot.docs;

  const hasMore = docs.length > limit;
  const resultDocs = hasMore ? docs.slice(0, limit) : docs;

  const items = resultDocs.map((doc) => ({
    id: doc.id,
    ...(doc.data() as any),
  })) as T[];

  const lastDoc = resultDocs[resultDocs.length - 1];
  const nextCursor = hasMore && lastDoc ? lastDoc.id : null;

  return {
    items,
    nextCursor,
    hasMore,
  };
}
