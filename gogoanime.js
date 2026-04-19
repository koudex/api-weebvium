/**
 * Anime API - GogoAnime Service
 * Contains all controllers, scrapers, extractors, and utilities for GogoAnime
 */

import { Router } from "express";
import axios from "axios";
import { load } from "cheerio";
import createHttpError from "http-errors";

// ==================== URL CONFIGURATION ====================

const createURLConfig = async (websites_collection, isSiteReachable) => {
  const gogoanime = websites_collection["GogoAnime"];
  let gogoanime_base = gogoanime.BASE;
  const clones_array = [gogoanime_base];

  if (gogoanime.CLONES) {
    for (const key in gogoanime.CLONES) {
      if (Object.prototype.hasOwnProperty.call(gogoanime.CLONES, key)) {
        clones_array.push(...gogoanime.CLONES[key]);
      }
    }
  }

  for (const url of clones_array) {
    if (await isSiteReachable(url)) {
      gogoanime_base = url;
      break;
    }
  }

  return {
    BASE: gogoanime_base,
    HOME: `${gogoanime_base}/home.html`,
    SEARCH: `${gogoanime_base}/search.html`,
    CATEGORY: `${gogoanime_base}/category/`,
    MOVIES: `${gogoanime_base}/anime-movies.html`,
    POPULAR: `${gogoanime_base}/popular.html`,
    NEW_SEASON: `${gogoanime_base}/new-season.html`,
    SEASONS: `${gogoanime_base}/sub-category/`,
    COMPLETED: `${gogoanime_base}/completed-anime.html`,
    AJAX: "https://ajax.gogocdn.net/ajax",
  };
};

// ==================== EXTRACTORS ====================

const extract_recent_released_home = ($, selectors) => {
  const animes = [];
  $(selectors).each((_index, element) => {
    const animeID = $(element).find("p.name > a")?.attr("href")?.split("/")[1]?.split("-episode-")[0] ?? "UNKNOWN";
    const episodeId = $(element).find("p.name > a")?.attr("href")?.split("/")[1] ?? "UNKNOWN";
    const animeNAME = $(element).find("p.name > a")?.attr("title") ?? "UNKNOWN";
    const episodeNo = Number($(element).find("p.episode").text().replace("Episode ", "").trim());
    const subOrDub = $(element).find("div > a > div")?.attr("class")?.replace("type ic-", "") || "UNKNOWN";
    const animeIMG = $(element).find("div > a > img")?.attr("src") ?? null;

    animes.push({
      id: animeID,
      name: animeNAME,
      img: animeIMG,
      episodeId: episodeId,
      episodeNo: episodeNo,
      subOrDub: subOrDub,
    });
  });
  return animes;
};

const extract_recently_added_series_home = ($, selectors) => {
  const animes = [];
  $(selectors).each((_index, element) => {
    const animeID = $(element).find("a")?.attr("href")?.split("/category/")[1] || null;
    const animeNAME = $(element).find("a")?.attr("title") || $(element).find("a")?.text()?.trim() || "UNKNOWN";

    animes.push({
      id: animeID,
      name: animeNAME,
      img: null,
    });
  });
  return animes;
};

const extract_latest_episodes = ($, selectors, url_base) => {
  const animes = [];
  $(selectors).each((_index, element) => {
    const animeID = $(element).find("p.name > a")?.attr("href")?.split("/")[1]?.split("-episode-")[0] ?? "UNKNOWN";
    const episodeId = $(element).find("p.name > a")?.attr("href")?.split("/")[1] ?? "UNKNOWN";
    const animeNAME = $(element).find("p.name > a")?.attr("title") ?? "UNKNOWN";
    const episodeNo = Number($(element).find("p.episode").text().replace("Episode ", "").trim());
    const subOrDub = $(element).find("div > a > div")?.attr("class")?.replace("type ic-", "") || "UNKNOWN";
    const animeIMG = $(element).find("div > a > img")?.attr("src") ?? null;
    const episodeUrl = url_base + "/" + $(element).find("p.name > a").attr("href");

    animes.push({
      id: animeID,
      name: animeNAME,
      img: animeIMG,
      episodeId: episodeId,
      episodeNo: episodeNo,
      episodeUrl: episodeUrl,
      subOrDub: subOrDub,
    });
  });
  return animes;
};

const extract_new_seasons = ($, selectors, url_base) => {
  const animes = [];
  $(selectors).each((_index, element) => {
    const animeID = $(element).find("p.name > a")?.attr("href")?.split("/category/")[1] ?? "UNKNOWN";
    const animeNAME = $(element).find("p.name > a")?.text()?.trim() ?? "UNKNOWN";
    const animeIMG = $(element).find("div > a > img")?.attr("src") ?? null;
    const releasedYear = $(element).find("p.released")?.text()?.replace("Released: ", "")?.trim() || null;
    const animeUrl = url_base + $(element).find("p.name > a")?.attr("href");

    animes.push({
      id: animeID,
      name: animeNAME,
      img: animeIMG,
      releasedYear: releasedYear,
      animeUrl: animeUrl,
    });
  });
  return animes;
};

const extract_popular_animes = ($, selectors, url_base) => {
  return extract_new_seasons($, selectors, url_base);
};

const extract_completed_animes = ($, selectors, url_base) => {
  return extract_new_seasons($, selectors, url_base);
};

const extract_anime_movies = ($, selectors, url_base) => {
  return extract_new_seasons($, selectors, url_base);
};

const extract_top_airing = ($, selectors, url_base) => {
  const animes = [];
  $(selectors).each((_index, element) => {
    const animeID = $(element).find("a")?.attr("href")?.split("/category/")[1] ?? "UNKNOWN";
    const animeNAME = $(element).find("a")?.attr("title") ?? "UNKNOWN";
    const animeIMG = $(element).find("div.thumbnail-popular > a > img")?.attr("src") ?? null;
    const latestEp = $(element).find("p.episode")?.text()?.trim() || null;
    const animeUrl = url_base + $(element).find("a")?.attr("href");
    
    const genres = [];
    $(element).find("p.genres a").each((_, el) => {
      genres.push($(el).text().trim());
    });

    animes.push({
      id: animeID,
      name: animeNAME,
      img: animeIMG,
      latestEp: latestEp,
      animeUrl: animeUrl,
      genres: genres,
    });
  });
  return animes;
};

const extract_searched_animes = ($, selectors) => {
  const animes = [];
  $(selectors).each((_index, element) => {
    const animeID = $(element).find("p.name > a")?.attr("href")?.split("/category/")[1] ?? "UNKNOWN";
    const animeNAME = $(element).find("p.name > a")?.text()?.trim() ?? "UNKNOWN";
    const animeIMG = $(element).find("div > a > img")?.attr("src") ?? null;
    const releasedYear = $(element).find("p.released")?.text()?.replace("Released: ", "")?.trim() || null;

    animes.push({
      id: animeID,
      name: animeNAME,
      img: animeIMG,
      releasedYear: releasedYear,
    });
  });
  return animes;
};

const extract_about_info = ($, selectors) => {
  let info = {
    name: null,
    img: null,
    type: null,
    genre: null,
    status: null,
    aired_in: null,
    other_name: null,
    episodes: null,
  };

  $(selectors).each((_index, _element) => {
    const animeNAME = $(selectors).find(".anime_info_episodes h2")?.text()?.split("/")?.pop() ?? "UNKNOWN ANIME";
    const animeIMG = $(selectors).find(".anime_info_body_bg img")?.attr("src")?.trim() ?? null;
    const animeTYPE = $(selectors).find("p.type:contains('Type:') a")?.text().replace("Type:", "").trim() || null;

    const animeGENRES = [];
    $(selectors).find("p.type:contains('Genre:') a").each((_, el) => {
      animeGENRES.push($(el).text().trim());
    });

    const animeSTATUS = $(selectors).find("p.type:contains('Status:') a")?.text().replace("Status:", "").trim() || null;
    const animeAIRED = parseInt($(selectors).find("p.type:contains('Released:')")?.text().replace("Released: ", "").trim()) || null;
    const animeOTHERNAME = $(selectors).find("p.type:contains('Other name:') a")?.text().replace("Other name:", "").trim() || null;
    const totalEPISODES = parseInt($(selectors).find("#episode_page li:last-child a").text().split("-")[1]) || 0;

    info = {
      name: animeNAME,
      img: animeIMG,
      type: animeTYPE,
      genre: animeGENRES,
      status: animeSTATUS,
      aired_in: animeAIRED,
      other_name: animeOTHERNAME,
      episodes: totalEPISODES,
    };
  });

  return info;
};

const extract_episodes = ($, selectors, url_base) => {
  const episodes = [];
  $(selectors).each((_index, element) => {
    const href = $(element).find("a")?.attr("href")?.trim() || "";
    const title = $(element).find("div.name")?.text()?.trim() || "";
    
    episodes.push({
      id: href.split("/")[1] || "",
      title: title,
      link: url_base + href,
    });
  });
  return episodes.reverse();
};

// ==================== SCRAPERS ====================

const scrapeHomePage = async (URLs, headers) => {
  const res = {
    genres: [],
    recentReleases: [],
    recentlyAddedSeries: [],
    onGoingSeries: [],
  };

  const mainPage = await axios.get(URLs.HOME, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);

  res.recentReleases = extract_recent_released_home($, "#load_recent_release > div.last_episodes.loaddub > ul > li");
  res.recentlyAddedSeries = extract_recently_added_series_home($, "#wrapper_bg > section > section.content_left > div.main_body.none > div.added_series_body.final > ul > li");
  res.onGoingSeries = extract_recently_added_series_home($, "#scrollbar2 > div.viewport > div > nav > ul > li");

  $("nav.menu_series.genre.right > ul > li").each((_index, element) => {
    const genre = $(element).find("a");
    const href = genre.attr("href");
    if (href) {
      res.genres.push(href.replace("/genre/", ""));
    }
  });

  return res;
};

const scrapeAboutPage = async (id, URLs, headers) => {
  const res = {
    id: id,
    anime_id: "",
    info: {},
  };

  const aboutURL = new URL(id, URLs.CATEGORY).toString();
  const mainPage = await axios.get(aboutURL, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);
  const animeId = $('input#movie_id.movie_id[type="hidden"]').attr('value') ?? '';
  
  res.anime_id = animeId;
  res.info = extract_about_info($, ".main_body");

  return res;
};

const scrapeSearchPage = async (query, page, URLs, headers) => {
  const res = {
    animes: [],
    currentPage: Number(page),
    hasNextPage: false,
    totalPages: 1,
  };

  const mainPage = await axios.get(`${URLs.SEARCH}?keyword=${query}&page=${page}`, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);

  res.animes = extract_searched_animes($, ".main_body .last_episodes .items li");
  res.hasNextPage = $("li.selected").next().length > 0;
  res.totalPages = Number($('li a[href*="page"]:last')?.attr("href")?.split("=").pop()) || 1;

  return res;
};

const scrapeRecentReleases = async (page, URLs, headers) => {
  const mainPage = await axios.get(`${URLs.AJAX}/page-recent-release.html?page=${page}`, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);
  return extract_latest_episodes($, "div.last_episodes.loaddub > ul > li", URLs.BASE);
};

const scrapeNewSeasons = async (page, URLs, headers) => {
  const mainPage = await axios.get(`${URLs.NEW_SEASON}?page=${page}`, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);
  return extract_new_seasons($, ".main_body .last_episodes .items li", URLs.BASE);
};

const scrapePopularAnime = async (page, URLs, headers) => {
  const mainPage = await axios.get(`${URLs.POPULAR}?page=${page}`, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);
  return extract_popular_animes($, ".main_body .last_episodes .items li", URLs.BASE);
};

const scrapeCompletedAnime = async (page, URLs, headers) => {
  const mainPage = await axios.get(`${URLs.COMPLETED}?page=${page}`, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);
  return extract_completed_animes($, ".main_body .last_episodes .items li", URLs.BASE);
};

const scrapeAnimeMovies = async (page, URLs, headers) => {
  const mainPage = await axios.get(`${URLs.MOVIES}?page=${page}`, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);
  return extract_anime_movies($, ".main_body .last_episodes .items li", URLs.BASE);
};

const scrapeTopAiring = async (page, URLs, headers) => {
  const mainPage = await axios.get(`${URLs.AJAX}/page-recent-release-ongoing.html?page=${page}`, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);
  return extract_top_airing($, "div.added_series_body.popular > ul > li", URLs.BASE);
};

const scrapeEpisodePage = async (id, URLs, headers) => {
  const res = { episodes: [] };

  const mainPage = await axios.get(`${URLs.AJAX}/load-list-episode?ep_start=0&ep_end=9999&id=${id}&default_ep=0`, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);
  res.episodes = extract_episodes($, "ul#episode_related li", URLs.BASE);

  return res;
};

// ==================== ROUTER FACTORY ====================

export const createGogoanimeRouter = ({ cacheManager, createResponse, asyncHandler, headers, websites_collection, isSiteReachable }) => {
  const router = Router();
  let URLsCache = null;

  const getURLs = async () => {
    if (!URLsCache) {
      URLsCache = await createURLConfig(websites_collection, isSiteReachable);
    }
    return URLsCache;
  };

  // Root redirect
  router.get("/", (req, res) => {
    res.json(createResponse(true, {
      message: "GogoAnime API",
      endpoints: ["/home", "/search", "/anime/:id", "/episodes/:id", "/recent-releases", "/new-seasons", "/popular", "/completed", "/anime-movies", "/top-airing"]
    }));
  });

  // Home page
  router.get("/home", cacheManager.middleware(), asyncHandler(async (req, res) => {
    const URLs = await getURLs();
    const data = await scrapeHomePage(URLs, headers);
    res.json(createResponse(true, data));
  }));

  // Search
  router.get("/search", cacheManager.middleware({ duration: 3600, keyParams: ["keyword", "page"] }), asyncHandler(async (req, res) => {
    const { keyword, page = 1 } = req.query;
    if (!keyword) {
      return res.status(400).json(createResponse(false, null, { message: "keyword parameter is required", code: "MISSING_PARAM", status: 400 }));
    }
    const URLs = await getURLs();
    const data = await scrapeSearchPage(keyword, Number(page), URLs, headers);
    res.json(createResponse(true, data));
  }));

  // Anime details
  router.get("/anime/:id", cacheManager.middleware(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const URLs = await getURLs();
    const data = await scrapeAboutPage(id, URLs, headers);
    res.json(createResponse(true, data));
  }));

  // Episodes list
  router.get("/episodes/:id", cacheManager.middleware(), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const URLs = await getURLs();
    const data = await scrapeEpisodePage(id, URLs, headers);
    res.json(createResponse(true, data));
  }));

  // Recent releases
  router.get("/recent-releases", cacheManager.middleware({ duration: 3600 * 24, keyParams: ["page"] }), asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const URLs = await getURLs();
    const data = await scrapeRecentReleases(page, URLs, headers);
    res.json(createResponse(true, data, null, { page }));
  }));

  // New seasons
  router.get("/new-seasons", cacheManager.middleware({ duration: 3600 * 24, keyParams: ["page"] }), asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const URLs = await getURLs();
    const data = await scrapeNewSeasons(page, URLs, headers);
    res.json(createResponse(true, data, null, { page }));
  }));

  // Popular anime
  router.get("/popular", cacheManager.middleware({ duration: 3600 * 24, keyParams: ["page"] }), asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const URLs = await getURLs();
    const data = await scrapePopularAnime(page, URLs, headers);
    res.json(createResponse(true, data, null, { page }));
  }));

  // Completed anime
  router.get("/completed", cacheManager.middleware({ duration: 3600 * 24, keyParams: ["page"] }), asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const URLs = await getURLs();
    const data = await scrapeCompletedAnime(page, URLs, headers);
    res.json(createResponse(true, data, null, { page }));
  }));

  // Anime movies
  router.get("/anime-movies", cacheManager.middleware({ duration: 3600 * 24, keyParams: ["page"] }), asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const URLs = await getURLs();
    const data = await scrapeAnimeMovies(page, URLs, headers);
    res.json(createResponse(true, data, null, { page }));
  }));

  // Top airing
  router.get("/top-airing", cacheManager.middleware({ duration: 3600 * 24, keyParams: ["page"] }), asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const URLs = await getURLs();
    const data = await scrapeTopAiring(page, URLs, headers);
    res.json(createResponse(true, data, null, { page }));
  }));

  return router;
};
