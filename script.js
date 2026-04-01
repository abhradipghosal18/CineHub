import {
  fetchTrending,
  fetchUpcoming,
  fetchNowPlaying,
  fetchMovieDetails,
  fetchGenres,
  fetchOMDB,
  searchMovies,
} from "./api.js";

import {
  debounce,
  formatRating,
  formatDate,
  posterURL,
  genreNames,
  sortMovies,
  filterMovies,
  buildScatteredPositions,
  ratingColor,
  truncate,
  buildSkeletonCards,
} from "./utils.js";

const state = {
  trending       : [],
  upcoming       : [],
  nowPlaying     : [],
  searchResults  : [],
  genreMap       : {},
  activeTab      : "trending",
  activeSort     : "popularity",
  activeGenre    : null,
  activeRating   : 0,
  darkMode       : true,
  searchQuery    : "",
  trendingPage   : 1,
  upcomingPage   : 1,
  nowPlayingPage : 1,
};

function setState(changes) {
  Object.assign(state, changes);
}

const searchInput        = document.getElementById("searchInput");
const trendingGrid       = document.getElementById("trendingGrid");
const upcomingGrid       = document.getElementById("upcomingGrid");
const nowPlayingGrid     = document.getElementById("nowPlayingGrid");
const searchGrid         = document.getElementById("searchResultsSection");
const heroPosters        = document.getElementById("heroPosters");
const themeToggle        = document.getElementById("themeToggle");
const filterGenre        = document.getElementById("filterGenre");
const filterRating       = document.getElementById("filterRating");
const sortSelect         = document.getElementById("sortSelect");
const trendingSection    = document.getElementById("trendingSection");
const upcomingSection    = document.getElementById("upcomingSection");
const nowPlayingSection  = document.getElementById("nowPlayingSection");
const searchSection      = document.getElementById("searchSection");
const searchTitle        = document.getElementById("searchTitle");
const movieModal         = document.getElementById("movieModal");
const modalBody          = document.getElementById("modalBody");
const modalClose         = document.getElementById("modalClose");
const loadingOverlay     = document.getElementById("loadingOverlay");
const ratingValue        = document.getElementById("ratingValue");
const toastContainer     = document.getElementById("toastContainer");
const tabButtons         = document.querySelectorAll(".tab-btn");
const loadMoreTrending   = document.getElementById("loadMoreTrending");
const loadMoreUpcoming   = document.getElementById("loadMoreUpcoming");
const loadMoreNowPlaying = document.getElementById("loadMoreNowPlaying");

function showLoading() {
  loadingOverlay.classList.add("active");
}

function hideLoading() {
  loadingOverlay.classList.remove("active");
}

function showInlineSpinner(container) {
  container.innerHTML = `
    <div class="modal-loading">
      <div class="spinner"></div>
    </div>`;
}

function showToast(message, type = "info") {
  const toast = document.createElement("div");
  toast.className = `toast toast--${type}`;
  toast.setAttribute("role", "alert");
  toast.textContent = message;
  toastContainer.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add("toast--visible"));
  setTimeout(() => {
    toast.classList.remove("toast--visible");
    toast.addEventListener("transitionend", () => toast.remove(), { once: true });
  }, 3500);
}

function buildCard(movie) {
  const rating = movie.vote_average ?? 0;
  const color  = ratingColor(rating);
  const genres = genreNames(movie.genre_ids ?? [], state.genreMap);
  const year   = movie.release_date ? movie.release_date.slice(0, 4) : "TBA";

  return `
    <article
      class="card"
      data-id="${movie.id}"
      tabindex="0"
      role="button"
      aria-label="View details for ${movie.title}"
    >
      <div class="card__poster-wrap">
        <img
          class="card__poster"
          src="${posterURL(movie.poster_path)}"
          alt="${movie.title} poster"
          loading="lazy"
        />
        <div class="card__overlay">
          <span class="card__play">▶ Details</span>
        </div>
        <span class="card__badge" style="--badge-color:${color}">
          ${formatRating(rating)}
        </span>
      </div>
      <div class="card__info">
        <h3 class="card__title" title="${movie.title}">
          ${truncate(movie.title, 30)}
        </h3>
        ${genres ? `<p class="card__genres">${genres}</p>` : ""}
        <p class="card__date">${year}</p>
      </div>
    </article>`;
}

function renderGrid(container, movies, mode = "replace") {
  if (mode === "replace") {
    if (movies.length === 0) {
      container.innerHTML = `
        <p class="empty-msg">
          No movies found. Try a different search or filter.
        </p>`;
      return;
    }
    container.innerHTML = movies.map(buildCard).join("");
  } else {
    const newCardsHTML = movies.map(buildCard).join("");
    container.insertAdjacentHTML("beforeend", newCardsHTML);
  }
  const allCards = container.querySelectorAll(".card");
  allCards.forEach((card, index) => {
    card.style.setProperty("--i", index);
  });
}

function renderHeroPosters(movies) {
  const positions = buildScatteredPositions(8);
  heroPosters.innerHTML = positions.map(function({ posStyle, rotate }, index) {
    const movie = movies[index];
    if (!movie) return "";
    return `
      <div
        class="hero-poster"
        style="${posStyle}; transform:rotate(${rotate}deg)"
        data-id="${movie.id}"
        tabindex="0"
        aria-label="Open details for ${movie.title}"
      >
        <img
          src="${posterURL(movie.poster_path, "w185")}"
          alt="${movie.title}"
          loading="lazy"
        />
        <span class="hero-poster__title">${truncate(movie.title, 18)}</span>
      </div>`;
  }).join("");
}

async function openModal(movieId) {
  movieModal.classList.add("active");
  document.body.style.overflow = "hidden";
  showInlineSpinner(modalBody);

  try {
    const details     = await fetchMovieDetails(movieId);
    const releaseYear = details.release_date ? details.release_date.slice(0, 4) : "";
    const omdb        = await fetchOMDB(details.title, releaseYear);
    const trailer     = findTrailer(details.videos?.results ?? []);
    const castHTML    = buildCastHTML(details.credits?.cast ?? []);
    const similarHTML = buildSimilarHTML(details.similar?.results ?? []);
    const genreTagsHTML = buildGenreTagsHTML(details.genres ?? []);
    const omdbHTML    = buildOmdbHTML(omdb);

    modalBody.innerHTML = buildModalHTML(
      details, trailer, castHTML, similarHTML, genreTagsHTML, omdbHTML, omdb
    );

    modalBody.querySelectorAll(".card").forEach(function(card) {
      card.addEventListener("click", function() {
        openModal(card.dataset.id);
      });
    });

  } catch (error) {
    modalBody.innerHTML = `
      <p class="error-msg">
        ⚠️ Could not load movie details. Please try again.
      </p>`;
  }
}

function findTrailer(videos) {
  return videos.find(function(video) {
    return video.type === "Trailer" && video.site === "YouTube";
  });
}

function buildCastHTML(castArray) {
  return castArray
    .slice(0, 8)
    .map(function(person) {
      return `<span class="cast-pill">${person.name}</span>`;
    })
    .join("");
}

function buildSimilarHTML(similarArray) {
  return similarArray
    .slice(0, 4)
    .map(buildCard)
    .join("");
}

function buildGenreTagsHTML(genresArray) {
  return genresArray
    .map(function(genre) {
      return `<span class="genre-tag">${genre.name}</span>`;
    })
    .join("");
}

function buildOmdbHTML(omdb) {
  if (!omdb) return "";
  const awardsSection = (omdb.awards && omdb.awards !== "N/A")
    ? `<div class="omdb-pill">🎖 ${truncate(omdb.awards, 55)}</div>`
    : "";
  return `
    <div class="modal-omdb">
      <div class="omdb-pill">💰 ${omdb.boxOffice}</div>
      <div class="omdb-pill">🏆 IMDb ${omdb.imdbRating}</div>
      ${awardsSection}
    </div>`;
}

function buildModalHTML(details, trailer, castHTML, similarHTML, genreTagsHTML, omdbHTML, omdb) {
  const ratedBadge = (omdb?.rated && omdb.rated !== "N/A")
    ? `<span class="rated-badge">${omdb.rated}</span>`
    : "";

  const trailerBtn = trailer
    ? `<a class="trailer-btn"
          href="https://youtube.com/watch?v=${trailer.key}"
          target="_blank"
          rel="noopener noreferrer">▶ Watch Trailer</a>`
    : "";

  const castSection = castHTML
    ? `<div class="modal-cast">
         <h4>Cast</h4>
         <div class="cast-list">${castHTML}</div>
       </div>`
    : "";

  const similarSection = similarHTML
    ? `<div class="similar-section">
         <h3>You Might Also Like</h3>
         <div class="similar-grid">${similarHTML}</div>
       </div>`
    : "";

  const tagline = details.tagline
    ? `<p class="modal-tagline">"${details.tagline}"</p>`
    : "";

  return `
    <div class="modal-backdrop"
         style="background-image:url('https://image.tmdb.org/t/p/w1280${details.backdrop_path}')">
      <div class="modal-backdrop__overlay"></div>
    </div>
    <div class="modal-content">
      <div class="modal-hero">
        <img
          class="modal-poster"
          src="${posterURL(details.poster_path, "w342")}"
          alt="${details.title} poster"
        />
        <div class="modal-meta">
          <h2 class="modal-title">${details.title}</h2>
          ${tagline}
          <div class="modal-stats">
            <span style="color:${ratingColor(details.vote_average)}">
              ${formatRating(details.vote_average)}
              <small>(${(details.vote_count ?? 0).toLocaleString()} votes)</small>
            </span>
            <span>📅 ${formatDate(details.release_date)}</span>
            <span>⏱ ${details.runtime ? details.runtime + " min" : "N/A"}</span>
            ${ratedBadge}
          </div>
          ${omdbHTML}
          <p class="modal-overview">
            ${details.overview || "No overview available."}
          </p>
          <div class="modal-genres">${genreTagsHTML}</div>
          ${castSection}
          ${trailerBtn}
        </div>
      </div>
      ${similarSection}
    </div>`;
}

function closeModal() {
  movieModal.classList.remove("active");
  document.body.style.overflow = "";
}

async function handleSearch(query) {
  setState({ searchQuery: query });

  if (!query.trim()) {
    searchSection.classList.add("hidden");
    showActiveTabSection();
    return;
  }

  searchSection.classList.remove("hidden");
  trendingSection.classList.add("hidden");
  upcomingSection.classList.add("hidden");
  nowPlayingSection.classList.add("hidden");
  searchGrid.innerHTML = buildSkeletonCards(10);

  try {
    const rawResults      = await searchMovies(query);
    const filteredResults = filterMovies(rawResults, {
      minRating : state.activeRating,
      genreId   : state.activeGenre,
    });
    const sortedResults = sortMovies(filteredResults, state.activeSort);

    setState({ searchResults: sortedResults });
    searchTitle.textContent = `Results for "${query}" (${sortedResults.length})`;
    renderGrid(searchGrid, sortedResults);

  } catch (error) {
    searchGrid.innerHTML = `
      <p class="error-msg">
        ⚠️ Search failed. Please check your connection and try again.
      </p>`;
    showToast("Search failed. Please try again.", "error");
  }
}

function applyFiltersAndSort() {
  const filterOptions = {
    minRating : state.activeRating,
    genreId   : state.activeGenre,
  };

  if (state.searchQuery) {
    const filtered = filterMovies(state.searchResults, filterOptions);
    const sorted   = sortMovies(filtered, state.activeSort);
    searchTitle.textContent = `Results for "${state.searchQuery}" (${sorted.length})`;
    renderGrid(searchGrid, sorted);
    return;
  }

  renderGrid(trendingGrid,
    sortMovies(filterMovies(state.trending, filterOptions), state.activeSort));
  renderGrid(upcomingGrid,
    sortMovies(filterMovies(state.upcoming, filterOptions), state.activeSort));
  renderGrid(nowPlayingGrid,
    sortMovies(filterMovies(state.nowPlaying, filterOptions), state.activeSort));
}

function switchTab(tabName) {
  setState({ activeTab: tabName });
  tabButtons.forEach(function(btn) {
    const isActive = btn.dataset.tab === tabName;
    btn.classList.toggle("tab-btn--active", isActive);
    btn.setAttribute("aria-selected", isActive);
  });
  trendingSection.classList.toggle("hidden",   tabName !== "trending");
  upcomingSection.classList.toggle("hidden",   tabName !== "upcoming");
  nowPlayingSection.classList.toggle("hidden", tabName !== "nowplaying");
}

function showActiveTabSection() {
  trendingSection.classList.toggle("hidden",   state.activeTab !== "trending");
  upcomingSection.classList.toggle("hidden",   state.activeTab !== "upcoming");
  nowPlayingSection.classList.toggle("hidden", state.activeTab !== "nowplaying");
}

async function loadMoreMovies(sectionName) {
  const config = {
    trending   : { fetchFn: fetchTrending,   pageKey: "trendingPage",   grid: trendingGrid,   stateKey: "trending"   },
    upcoming   : { fetchFn: fetchUpcoming,   pageKey: "upcomingPage",   grid: upcomingGrid,   stateKey: "upcoming"   },
    nowplaying : { fetchFn: fetchNowPlaying, pageKey: "nowPlayingPage", grid: nowPlayingGrid, stateKey: "nowPlaying" },
  };

  const { fetchFn, pageKey, grid, stateKey } = config[sectionName];

  const button = {
    trending   : loadMoreTrending,
    upcoming   : loadMoreUpcoming,
    nowplaying : loadMoreNowPlaying,
  }[sectionName];

  button.disabled    = true;
  button.textContent = "Loading…";

  try {
    const nextPage  = state[pageKey] + 1;
    const newMovies = await fetchFn(nextPage);
    setState({
      [pageKey]  : nextPage,
      [stateKey] : [...state[stateKey], ...newMovies],
    });
    renderGrid(grid, newMovies, "append");
  } catch (error) {
    showToast("Could not load more movies. Try again.", "error");
  } finally {
    button.disabled    = false;
    button.textContent = "Load More";
  }
}

function toggleTheme() {
  setState({ darkMode: !state.darkMode });
  document.documentElement.setAttribute(
    "data-theme",
    state.darkMode ? "dark" : "light"
  );
  themeToggle.textContent = state.darkMode ? "☀️" : "🌙";
  themeToggle.setAttribute(
    "aria-label",
    state.darkMode ? "Switch to light mode" : "Switch to dark mode"
  );
  localStorage.setItem("cinehub-theme", state.darkMode ? "dark" : "light");
}

function populateGenreDropdown(genres) {
  const optionsHTML = genres
    .map(function(genre) {
      return `<option value="${genre.id}">${genre.name}</option>`;
    })
    .join("");
  filterGenre.innerHTML = `<option value="">All Genres</option>${optionsHTML}`;
}

async function init() {
  const savedTheme = localStorage.getItem("cinehub-theme") ?? "dark";
  setState({ darkMode: savedTheme === "dark" });
  document.documentElement.setAttribute("data-theme", savedTheme);
  themeToggle.textContent = state.darkMode ? "☀️" : "🌙";

  trendingGrid.innerHTML   = buildSkeletonCards(10);
  upcomingGrid.innerHTML   = buildSkeletonCards(10);
  nowPlayingGrid.innerHTML = buildSkeletonCards(10);

  showLoading();

  try {
    const [trending, upcoming, nowPlaying, genres] = await Promise.all([
      fetchTrending(),
      fetchUpcoming(),
      fetchNowPlaying(),
      fetchGenres(),
    ]);

    const genreMap = genres.reduce(function(map, genre) {
      map[genre.id] = genre.name;
      return map;
    }, {});

    setState({ trending, upcoming, nowPlaying, genreMap });

    populateGenreDropdown(genres);
    renderHeroPosters(trending);
    renderGrid(trendingGrid,   trending);
    renderGrid(upcomingGrid,   upcoming);
    renderGrid(nowPlayingGrid, nowPlaying);

    showToast("Welcome to CineHub 🎬", "success");

  } catch (error) {
    trendingGrid.innerHTML = `
      <p class="error-msg">
        ⚠️ Failed to load movies. Please check your internet
        connection and refresh the page.
      </p>`;
    showToast("Failed to load movies.", "error");
    console.error("CineHub init error:", error);
  } finally {
    hideLoading();
  }
}

const debouncedSearch = debounce(handleSearch, 400);

searchInput.addEventListener("input", function(e) {
  debouncedSearch(e.target.value);
});
searchInput.addEventListener("search", function(e) {
  if (!e.target.value) handleSearch("");
});
sortSelect.addEventListener("change", function(e) {
  setState({ activeSort: e.target.value });
  applyFiltersAndSort();
});
filterGenre.addEventListener("change", function(e) {
  setState({ activeGenre: e.target.value || null });
  applyFiltersAndSort();
});
filterRating.addEventListener("input", function(e) {
  setState({ activeRating: Number(e.target.value) });
  ratingValue.textContent = e.target.value + "+";
  applyFiltersAndSort();
});
tabButtons.forEach(function(btn) {
  btn.addEventListener("click", function() {
    if (state.searchQuery) return;
    switchTab(btn.dataset.tab);
  });
});
loadMoreTrending.addEventListener("click",   function() { loadMoreMovies("trending"); });
loadMoreUpcoming.addEventListener("click",   function() { loadMoreMovies("upcoming"); });
loadMoreNowPlaying.addEventListener("click", function() { loadMoreMovies("nowplaying"); });
themeToggle.addEventListener("click", toggleTheme);
modalClose.addEventListener("click", closeModal);
movieModal.addEventListener("click", function(e) {
  if (e.target === movieModal) closeModal();
});
document.addEventListener("keydown", function(e) {
  if (e.key === "Escape") closeModal();
});
document.addEventListener("click", function(e) {
  const card = e.target.closest(".card[data-id]");
  if (card) openModal(card.dataset.id);
});
document.addEventListener("keydown", function(e) {
  if (e.key === "Enter" || e.key === " ") {
    const card = e.target.closest(".card[data-id]");
    if (card) {
      e.preventDefault();
      openModal(card.dataset.id);
    }
  }
});
heroPosters.addEventListener("click", function(e) {
  const poster = e.target.closest(".hero-poster[data-id]");
  if (poster) openModal(poster.dataset.id);
});
heroPosters.addEventListener("keydown", function(e) {
  if (e.key === "Enter") {
    const poster = e.target.closest(".hero-poster[data-id]");
    if (poster) openModal(poster.dataset.id);
  }
});

init();
