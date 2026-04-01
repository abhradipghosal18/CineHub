export function debounce(fn, delay = 400) {
  let timer;
  return function(...args) {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
}

export function formatRating(vote) {
  if (!vote) return "N/A";
  return "⭐ " + Number(vote).toFixed(1);
}

export function formatDate(dateStr) {
  if (!dateStr) return "TBA";
  return new Date(dateStr).toLocaleDateString("en-US", {
    year  : "numeric",
    month : "short",
    day   : "numeric",
  });
}

export function posterURL(path, size = "w342") {
  if (!path) {
    return "https://placehold.co/342x513/0a0a1a/e50914?text=No+Poster";
  }
  return `https://image.tmdb.org/t/p/${size}${path}`;
}

export function genreNames(ids = [], genreMap = {}) {
  return ids
    .slice(0, 3)
    .map(id => genreMap[id])
    .filter(Boolean)
    .join(" · ");
}

export function sortMovies(movies, mode) {
  const copy = [...movies];
  if (mode === "rating") {
    return copy.sort((a, b) => b.vote_average - a.vote_average);
  }
  if (mode === "date") {
    return copy.sort((a, b) => new Date(b.release_date) - new Date(a.release_date));
  }
  if (mode === "title") {
    return copy.sort((a, b) => a.title.localeCompare(b.title));
  }
  return copy.sort((a, b) => b.popularity - a.popularity);
}

export function filterMovies(movies, { minRating = 0, genreId = null } = {}) {
  return movies.filter(function(movie) {
    const passesRating = movie.vote_average >= minRating;
    const passesGenre  = !genreId ||
                         (movie.genre_ids ?? []).includes(Number(genreId));
    return passesRating && passesGenre;
  });
}

export function ratingColor(score) {
  if (score >= 7.5) return "var(--green)";
  if (score >= 5.5) return "var(--amber)";
  return "var(--red)";
}

export function truncate(str = "", maxLength = 120) {
  if (str.length <= maxLength) return str;
  return str.slice(0, maxLength).trimEnd() + "…";
}

export function buildScatteredPositions(count) {
  const slots = [
    { top: "8%",  left:  "2%",  rotate: -14 },
    { top: "3%",  left:  "16%", rotate:   8 },
    { top: "55%", left:  "1%",  rotate:  12 },
    { top: "60%", left:  "15%", rotate:  -7 },
    { top: "5%",  right: "2%",  rotate:  11 },
    { top: "5%",  right: "16%", rotate: -10 },
    { top: "55%", right: "1%",  rotate:  -9 },
    { top: "58%", right: "16%", rotate:  13 },
  ];
  return slots.slice(0, count).map(function(slot) {
    const posStyle = Object.entries(slot)
      .filter(([key]) => key !== "rotate")
      .map(([key, value]) => `${key}:${value}`)
      .join(";");
    return { posStyle, rotate: slot.rotate };
  });
}

export function buildSkeletonCards(count = 10) {
  return Array.from({ length: count }).map(() => `
    <div class="card card--skeleton" aria-hidden="true">
      <div class="card__poster-wrap skeleton-box"></div>
      <div class="card__info">
        <div class="skeleton-line" style="width:75%"></div>
        <div class="skeleton-line" style="width:50%"></div>
        <div class="skeleton-line" style="width:35%"></div>
      </div>
    </div>
  `).join("");
}
