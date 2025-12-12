import { Injectable, Logger } from '@nestjs/common';

export interface DeezerTrack {
  id: number;
  title: string;
  duration: number;
  preview: string;
  artist: {
    id: number;
    name: string;
  };
  album: {
    id: number;
    title: string;
    cover: string;
    cover_medium: string;
    cover_big: string;
  };
}

export interface DeezerSearchResponse {
  data: DeezerTrack[];
  total: number;
  next?: string;
}

@Injectable()
export class DeezerService {
  private readonly logger = new Logger(DeezerService.name);
  private readonly baseUrl = 'https://api.deezer.com';

  /**
   * Search for tracks on Deezer
   * @param query - Search query (artist, song title, etc.)
   * @param limit - Maximum number of results (default 25)
   */
  async searchTracks(query: string, limit = 25): Promise<DeezerTrack[]> {
    try {
      const url = `${this.baseUrl}/search?q=${encodeURIComponent(query)}&limit=${limit}`;
      const response = await fetch(url);

      if (!response.ok) {
        throw new Error(`Deezer API error: ${response.status}`);
      }

      const data: DeezerSearchResponse = await response.json();
      return data.data || [];
    } catch (error) {
      this.logger.error(`Failed to search Deezer: ${error.message}`);
      throw error;
    }
  }

  /**
   * Get a specific track by ID
   * @param trackId - Deezer track ID
   */
  async getTrack(trackId: number): Promise<DeezerTrack | null> {
    try {
      const url = `${this.baseUrl}/track/${trackId}`;
      const response = await fetch(url);

      if (!response.ok) {
        if (response.status === 404) {
          return null;
        }
        throw new Error(`Deezer API error: ${response.status}`);
      }

      return await response.json();
    } catch (error) {
      this.logger.error(`Failed to get Deezer track: ${error.message}`);
      throw error;
    }
  }
}
