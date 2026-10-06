import { isGenericPreview } from "@shared/preview-urls";
import { fetchLinkPreview } from "./link-preview";

export interface MoviePreview {
  posterUrl: string | null;
  title: string | null;
  year: string | null;
  rating: number | null;
  genres: string[] | null;
}

export async function fetchMoviePreview(imdbId: string, url: string, signal?: AbortSignal): Promise<MoviePreview | null> {
  let movie: MoviePreview | null = null;
  try {
    const response = await fetch(`/api/tmdb/movie/${imdbId}`, { signal });
    if (response.ok) movie = await response.json();
    if (movie?.posterUrl && movie.title) return movie;
  } catch (error) {
    if (signal?.aborted) throw error;
    // A movie-provider outage must not prevent the independent page fallback.
  }
  signal?.throwIfAborted();
  try {
    const data = await fetchLinkPreview(url);
    if (data.image || (data.title && !data.isFallback && !isGenericPreview(url, data.title))) {
      return {
        posterUrl: data.image || movie?.posterUrl || null,
        title: data.title || movie?.title || "IMDb title",
        year: movie?.year || null,
        rating: movie?.rating || null,
        genres: movie?.genres || null,
      };
    }
  } catch {
    // Return useful TMDB text if page metadata cannot be obtained either.
  }
  return movie;
}
