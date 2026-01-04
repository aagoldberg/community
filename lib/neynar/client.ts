const NEYNAR_API_BASE = "https://api.neynar.com/v2";

interface NeynarCast {
  hash: string;
  author: {
    fid: number;
    username: string;
    display_name: string;
    pfp_url: string;
  };
  text: string;
  timestamp: string;
  parent_hash: string | null;
  parent_author: {
    fid: number | null;
  } | null;
  replies: {
    count: number;
  };
  reactions: {
    likes_count: number;
    recasts_count: number;
  };
}

interface FetchCastsResponse {
  casts: NeynarCast[];
  next: {
    cursor: string | null;
  };
}

interface FetchRepliesResponse {
  conversation: {
    cast: NeynarCast & {
      direct_replies: NeynarCast[];
    };
  };
}

export interface NormalizedCast {
  hash: string;
  fid: number;
  timestamp: Date;
  text: string;
  parentHash: string | null;
  parentFid: number | null;
  replyCount: number;
}

export interface NormalizedReply {
  hash: string;
  parentHash: string;
  authorFid: number;
  timestamp: Date;
  text: string;
}

class NeynarClient {
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
  }

  private async fetch<T>(
    endpoint: string,
    params?: Record<string, string>
  ): Promise<T> {
    const url = new URL(`${NEYNAR_API_BASE}${endpoint}`);
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }

    const response = await fetch(url.toString(), {
      headers: {
        accept: "application/json",
        api_key: this.apiKey,
      },
    });

    if (!response.ok) {
      const error = await response.text();
      throw new Error(`Neynar API error: ${response.status} ${error}`);
    }

    return response.json();
  }

  async fetchUserCasts(
    fid: number,
    options: {
      limit?: number;
      cursor?: string | null;
      includeReplies?: boolean;
    } = {}
  ): Promise<{ casts: NormalizedCast[]; nextCursor: string | null }> {
    const { limit = 50, cursor, includeReplies = true } = options;

    const params: Record<string, string> = {
      fid: fid.toString(),
      limit: limit.toString(),
      include_replies: includeReplies.toString(),
    };

    if (cursor) {
      params.cursor = cursor;
    }

    const response = await this.fetch<FetchCastsResponse>(
      "/farcaster/feed/user/casts",
      params
    );

    const casts = response.casts.map(
      (cast): NormalizedCast => ({
        hash: cast.hash,
        fid: cast.author.fid,
        timestamp: new Date(cast.timestamp),
        text: cast.text,
        parentHash: cast.parent_hash,
        parentFid: cast.parent_author?.fid ?? null,
        replyCount: cast.replies.count,
      })
    );

    return {
      casts,
      nextCursor: response.next.cursor,
    };
  }

  async fetchCastReplies(
    hash: string,
    options: { limit?: number } = {}
  ): Promise<NormalizedReply[]> {
    const { limit = 50 } = options;

    try {
      const response = await this.fetch<FetchRepliesResponse>(
        "/farcaster/cast/conversation",
        {
          identifier: hash,
          type: "hash",
          reply_depth: "1",
          limit: limit.toString(),
        }
      );

      const directReplies = response.conversation.cast.direct_replies || [];

      return directReplies.map(
        (reply): NormalizedReply => ({
          hash: reply.hash,
          parentHash: hash,
          authorFid: reply.author.fid,
          timestamp: new Date(reply.timestamp),
          text: reply.text,
        })
      );
    } catch (error) {
      // If conversation not found, return empty
      console.error(`Error fetching replies for ${hash}:`, error);
      return [];
    }
  }

  async fetchUserProfile(fid: number): Promise<{
    fid: number;
    username: string;
    displayName: string;
    pfpUrl: string;
  } | null> {
    try {
      const response = await this.fetch<{
        users: Array<{
          fid: number;
          username: string;
          display_name: string;
          pfp_url: string;
        }>;
      }>("/farcaster/user/bulk", {
        fids: fid.toString(),
      });

      const user = response.users[0];
      if (!user) return null;

      return {
        fid: user.fid,
        username: user.username,
        displayName: user.display_name,
        pfpUrl: user.pfp_url,
      };
    } catch {
      return null;
    }
  }
}

// Singleton instance
let clientInstance: NeynarClient | null = null;

export function getNeynarClient(): NeynarClient {
  if (!clientInstance) {
    const apiKey = process.env.NEYNAR_API_KEY;
    if (!apiKey) {
      throw new Error("NEYNAR_API_KEY is not set");
    }
    clientInstance = new NeynarClient(apiKey);
  }
  return clientInstance;
}

// Utility functions
export function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export function chunk<T>(arr: T[], size: number): T[][] {
  return Array.from({ length: Math.ceil(arr.length / size) }, (_, i) =>
    arr.slice(i * size, i * size + size)
  );
}
