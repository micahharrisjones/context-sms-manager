import { log } from "./vite";

// TMDB Service for fetching movie data and poster images
class TMDBService {
  private apiKey: string;
  private baseUrl = "https://api.themoviedb.org/3";
  private imageBaseUrl = "https://image.tmdb.org/t/p/w500"; // 500px width posters

  constructor() {
    this.apiKey = process.env.TMDB_API_KEY || '';
    if (!this.apiKey) {
      log("Warning: TMDB_API_KEY not configured - IMDB poster enhancement disabled");
    }
  }

  // Extract IMDB ID from IMDB URL
  private extractImdbId(url: string): string | null {
    const imdbRegex = /(?:imdb\.com\/title\/)?(tt\d+)/;
    const match = url.match(imdbRegex);
    return match ? match[1] : null;
  }

  // Find movie by IMDB ID using TMDB API
  async findMovieByImdbId(imdbId: string): Promise<any> {
    if (!this.apiKey) {
      return null;
    }

    try {
      const response = await fetch(
        `${this.baseUrl}/find/${imdbId}?api_key=${this.apiKey}&external_source=imdb_id`
      );

      if (!response.ok) {
        log(`TMDB API error: ${response.status} - ${response.statusText}`);
        return null;
      }

      const data = await response.json();
      
      if (data.movie_results && data.movie_results.length > 0) {
        return data.movie_results[0];
      }

      return null;
    } catch (error) {
      log(`Error fetching from TMDB: ${error instanceof Error ? error.message : String(error)}`);
      return null;
    }
  }

  // Get movie poster URL from TMDB data
  private buildPosterUrl(posterPath: string | null): string | null {
    if (!posterPath) {
      return null;
    }
    return `${this.imageBaseUrl}${posterPath}`;
  }

  // Main function to get movie poster for IMDB URL
  async getMoviePoster(imdbUrl: string): Promise<{ 
    posterUrl: string | null, 
    title: string | null, 
    year: string | null,
    rating: number | null 
  }> {
    const imdbId = this.extractImdbId(imdbUrl);
    
    if (!imdbId) {
      log(`Invalid IMDB URL format: ${imdbUrl}`);
      return { posterUrl: null, title: null, year: null, rating: null };
    }

    log(`Fetching TMDB data for IMDB ID: ${imdbId}`);
    const movieData = await this.findMovieByImdbId(imdbId);
    
    if (!movieData) {
      log(`No TMDB data found for IMDB ID: ${imdbId}`);
      return { posterUrl: null, title: null, year: null, rating: null };
    }

    const posterUrl = this.buildPosterUrl(movieData.poster_path);
    const releaseYear = movieData.release_date ? new Date(movieData.release_date).getFullYear().toString() : null;
    
    log(`Found TMDB data for "${movieData.title}": poster=${posterUrl ? 'available' : 'none'}`);
    
    return {
      posterUrl,
      title: movieData.title || null,
      year: releaseYear,
      rating: movieData.vote_average || null
    };
  }

  // Check if a URL is an IMDB link
  isImdbUrl(url: string): boolean {
    return /imdb\.com\/title\/tt\d+/i.test(url);
  }

  // Enhanced link preview for IMDB URLs with movie poster
  async generateImdbPreview(url: string): Promise<{
    url: string,
    title: string,
    description: string,
    posterUrl: string | null,
    type: 'imdb'
  }> {
    const movieData = await this.getMoviePoster(url);
    
    const title = movieData.title || "Movie";
    const year = movieData.year ? ` (${movieData.year})` : "";
    const rating = movieData.rating ? ` • ⭐ ${movieData.rating.toFixed(1)}` : "";
    
    return {
      url,
      title: `🎬 ${title}${year}`,
      description: `IMDB Movie${rating}`,
      posterUrl: movieData.posterUrl,
      type: 'imdb' as const
    };
  }
}

export const tmdbService = new TMDBService();