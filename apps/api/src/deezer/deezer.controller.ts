import { Controller, Get, Query, Param, ParseIntPipe } from '@nestjs/common';
import { DeezerService } from './deezer.service';

@Controller('deezer')
export class DeezerController {
  constructor(private readonly deezerService: DeezerService) {}

  /**
   * Search for tracks on Deezer
   * GET /deezer/search?q=<query>&limit=<limit>
   */
  @Get('search')
  async search(
    @Query('q') query: string,
    @Query('limit') limit?: string,
  ) {
    if (!query || query.trim().length === 0) {
      return { data: [], total: 0 };
    }

    const tracks = await this.deezerService.searchTracks(
      query.trim(),
      limit ? parseInt(limit, 10) : 25,
    );

    return {
      data: tracks,
      total: tracks.length,
    };
  }

  /**
   * Get a specific track by ID
   * GET /deezer/track/:id
   */
  @Get('track/:id')
  async getTrack(@Param('id', ParseIntPipe) id: number) {
    const track = await this.deezerService.getTrack(id);
    return track;
  }
}
