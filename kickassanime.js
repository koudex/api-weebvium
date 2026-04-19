/**
 * Anime API - KickAssAnime Service
 * Contains all controllers, scrapers, extractors, and utilities for KickAssAnime
 */

import { Router } from "express";
import axios from "axios";
import createHttpError from "http-errors";

// ==================== URL CONFIGURATION ====================

const createURLConfig = async (websites_collection, isSiteReachable) => {
  const kickassanime = websites_collection["KickAssAnime"];
  let kickassanime_base = kickassanime.BASE;
  const clones_array = [kickassanime_base];

  if (kickassanime.CLONES) {
    for (const key in kickassanime.CLONES) {
      if (Object.prototype.hasOwnProperty.call(kickassanime.CLONES, key)) {
        clones_array.push(...kickassanime.CLONES[key]);
      }
    }
  }

  for (const url of clones_array) {
    if (await isSiteReachable(url)) {
      kickassanime_base = url;
      break;
    }
  }

  return {
    BASE: kickassanime_base,
    SEARCH: `${kickassanime_base}/api/fsearch`,
    SHOW: `${kickassanime_base}/api/show`,
    RECENT: `${kickassanime_base}/api/recent`,
    IMAGE: `${kickassanime_base}/image`,
  };
};

// ==================== UTILITIES ====================

const mapStatus = (status) => {
  switch (status) {
    case "finished_airing":
      return "Completed";
    case "currently_airing":
      return "Ongoing";
    case "not_yet_aired":
      return "Not Yet Aired";
    default:
      return "Unknown";
  }
};

// ==================== SCRAPERS ====================

const scrapeSearchPage = async (query, page, URLs, headers) => {
  const res = {
    animes: [],
    currentPage: Number(page),
    hasNextPage: false,
    totalPages: 1,
  };

  try {
    const response = await axios.post(
      URLs.SEARCH,
      { page: page, query: query },
      {
        headers: {
          "User-Agent": headers.USER_AGENT_HEADER,
          "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
          Accept: "application/json, text/plain, */*",
          "Content-Type": "application/json",
          Referer: `${URLs.BASE}/anime`,
        },
        timeout: 15000,
      }
    );

    const responseData = response.data;

    const searchResults = responseData.result.map((anime) => {
      const imgUrl = anime.poster
        ? `${URLs.IMAGE}/${anime.poster.hq}.${anime.poster.formats[0]}`
        : null;

      return {
        id: anime.slug,
        title: anime.title,
        url: anime.watch_uri
          ? `${URLs.BASE}${anime.watch_uri}`
          : `${URLs.BASE}/${anime.slug}`,
        img: imgUrl,
        releaseDate: anime.year?.toString() || null,
        subOrDub: anime.locales?.includes("en-US") ? "dub" : "sub",
        status: mapStatus(anime.status),
        otherName: anime.title_en || null,
        totalEpisodes: anime.episode_count || null,
      };
    });

    res.animes = searchResults;
    res.hasNextPage = page < responseData.maxPage;
    res.totalPages = responseData.maxPage || 1;

    return res;
  } catch (err) {
    console.error("Error in scrapeSearchPage:", err.message);
    throw createHttpError.InternalServerError("Failed to fetch search results");
  }
};

const scrapeAboutPage = async (id, URLs, headers) => {
  try {
    const requestHeaders = {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: "application/json, text/plain, */*",
      Host: new URL(URLs.BASE).host,
    };

    // Get anime info
    const animeResponse = await axios.get(`${URLs.SHOW}/${id}`, {
      headers: requestHeaders,
      timeout: 15000,
    });
    const animeData = animeResponse.data;

    // Get episodes
    const episodesResponse = await axios.get(
      `${URLs.SHOW}/${id}/episodes?page=1&lang=ja-JP`,
      { headers: requestHeaders, timeout: 15000 }
    );
    const episodesData = episodesResponse.data;

    const episodes = episodesData.result.map((ep) => ({
      id: `${id}/episode/ep-${Math.floor(ep.episode_number)}-${ep.slug}`,
      title: ep.title || null,
      number: Math.floor(ep.episode_number),
      img: ep.thumbnail
        ? `${URLs.IMAGE}/${ep.thumbnail.hq}.${ep.thumbnail.formats[0]}`
        : null,
      url: `${URLs.SHOW}/${id}/episode/ep-${Math.floor(ep.episode_number)}-${ep.slug}`,
    }));

    const imgUrl = animeData.poster
      ? `${URLs.IMAGE}/${animeData.poster.hq}.${animeData.poster.formats[0]}`
      : null;

    const coverUrl = animeData.banner
      ? `${URLs.IMAGE}/${animeData.banner.hq}.${animeData.banner.formats[0]}`
      : null;

    return {
      id: animeData.slug,
      title: animeData.title_en || animeData.title,
      url: `${URLs.BASE}/${animeData.slug}`,
      genres: animeData.genres || [],
      totalEpisodes: episodes.length,
      img: imgUrl,
      cover: coverUrl,
      description: animeData.synopsis || null,
      episodes: episodes,
      subOrDub: animeData.locales?.includes("en-US") ? "dub" : "sub",
      type: animeData.type?.toUpperCase() || null,
      status: mapStatus(animeData.status),
      otherName: animeData.title_original || null,
      releaseDate: animeData.year?.toString() || null,
    };
  } catch (err) {
    console.error("Error in scrapeAboutPage:", err.message);
    throw createHttpError.InternalServerError("Failed to fetch anime details");
  }
};

const scrapeRecentPage = async (page, URLs, headers) => {
  const res = {
    animes: [],
    currentPage: Number(page),
    hasNextPage: false,
    totalPages: 1,
  };

  try {
    const response = await axios.get(`${URLs.RECENT}?page=${page}`, {
      headers: {
        "User-Agent": headers.USER_AGENT_HEADER,
        "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
        Accept: "application/json, text/plain, */*",
        Host: new URL(URLs.BASE).host,
      },
      timeout: 15000,
    });

    const responseData = response.data;

    const recentAnimes = responseData.result.map((anime) => {
      const imgUrl = anime.poster
        ? `${URLs.IMAGE}/${anime.poster.hq}.${anime.poster.formats[0]}`
        : null;

      return {
        id: anime.slug,
        title: anime.title,
        img: imgUrl,
        episodeId: anime.episode?.slug || null,
        episodeNo: anime.episode?.episode_number
          ? Math.floor(anime.episode.episode_number)
          : null,
        subOrDub: anime.locales?.includes("en-US") ? "dub" : "sub",
      };
    });

    res.animes = recentAnimes;
    res.hasNextPage = page < (responseData.maxPage || 1);
    res.totalPages = responseData.maxPage || 1;

    return res;
  } catch (err) {
    console.error("Error in scrapeRecentPage:", err.message);
    throw createHttpError.InternalServerError("Failed to fetch recent releases");
  }
};

const scrapeEpisodeServers = async (episodeId, URLs, headers) => {
  try {
    const requestHeaders = {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: "application/json, text/plain, */*",
      Host: new URL(URLs.BASE).host,
    };

    const episodeUrl = `${URLs.SHOW}/${episodeId}`;
    const response = await axios.get(episodeUrl, {
      headers: requestHeaders,
      timeout: 15000,
    });

    const responseData = response.data;

    const servers = (responseData.servers || []).map((server) => ({
      name: server.name,
      url: server.src,
    }));

    return {
      episodeId: episodeId,
      servers: servers,
    };
  } catch (err) {
    console.error("Error in scrapeEpisodeServers:", err.message);
    throw createHttpError.InternalServerError("Failed to fetch episode servers");
  }
};

// ==================== ROUTER FACTORY ====================

export const createKickassanimeRouter = ({ cacheManager, createResponse, asyncHandler, headers, websites_collection, isSiteReachable }) => {
  const router = Router();
  let URLsCache = null;

  const getURLs = async () => {
    if (!URLsCache) {
      URLsCache = await createURLConfig(websites_collection, isSiteReachable);
    }
    return URLsCache;
  };

  // Root info
  router.get("/", (req, res) => {
    res.json(createResponse(true, {
      message: "KickAssAnime API",
      endpoints: ["/search", "/anime/:id", "/recent", "/servers/*"]
    }));
  });

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

  // Recent releases
  router.get("/recent", cacheManager.middleware({ duration: 3600 * 24, keyParams: ["page"] }), asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const URLs = await getURLs();
    const data = await scrapeRecentPage(page, URLs, headers);
    res.json(createResponse(true, data));
  }));

  // Episode servers (wildcard route)
  router.get("/servers/*", cacheManager.middleware(), asyncHandler(async (req, res) => {
    const episodeId = req.params[0];
    if (!episodeId) {
      return res.status(400).json(createResponse(false, null, { message: "Episode ID is required", code: "MISSING_PARAM", status: 400 }));
    }
    const URLs = await getURLs();
    const data = await scrapeEpisodeServers(episodeId, URLs, headers);
    res.json(createResponse(true, data));
  }));

  return router;
};
