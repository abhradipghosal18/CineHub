const TMDB_KEY  = "8265bd1679663a7ea12ac168da84d2e8";
const OMDB_KEY  = "trilogy";

const TMDB_BASE = "https://api.themoviedb.org/3";
const OMDB_BASE = "https://www.omdbapi.com";

export const IMG_BASE = "https://image.tmdb.org/t/p/w342";

async function tmdbFetch(endpoint, params = {}) {
  const url = new URL(TMDB_BASE + endpoint);
  url.searchParams.set("api_key", TMDB_KEY);
  Object.entries(params).forEach(([key, value]) => {
    url.searchParams.set(key, value);
  });
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`TMDB error ${response.status}: ${response.statusText}`);
  }
  return response.json();
}

export async function fetchTrending(page = 1) {
  const data = await tmdbFetch("/trending/movie/week", { page });
  return data.results;
}

export async function fetchUpcoming(page = 1) {
  const data = await tmdbFetch("/movie/upcoming", { page, region: "US" });
  return data.results;
}

export async function fetchNowPlaying(page = 1) {
  const data = await tmdbFetch("/movie/now_playing", { page, region: "US" });
  return data.results;
}

export async function searchMovies(query, page = 1) {
  if (!query.trim()) return [];
  const data = await tmdbFetch("/search/movie", { query, page });
  return data.results;
}

export async function fetchMovieDetails(id) {
  return tmdbFetch(`/movie/${id}`, {
    append_to_response: "credits,videos,similar",
  });
}

export async function fetchGenres() {
  const data = await tmdbFetch("/genre/movie/list");
  return data.genres;
}

export async function fetchOMDB(title, year = "") {
  try {
    const url = new URL(OMDB_BASE);
    url.searchParams.set("apikey", OMDB_KEY);
    url.searchParams.set("t", title);
    if (year) url.searchParams.set("y", year);
    const response = await fetch(url.toString());
    const data     = await response.json();
    if (data.Response === "False") return null;
    return {
      imdbRating : data.imdbRating ?? "N/A",
      boxOffice  : data.BoxOffice  ?? "N/A",
      awards     : data.Awards     ?? "N/A",
      rated      : data.Rated      ?? "N/A",
    };
  } catch (error) {
    return null;
  }
}
