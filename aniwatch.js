/**
 * Anime API - AniWatch/HiAnime Service
 * Contains all controllers, scrapers, extractors, and utilities for AniWatch
 */

import { Router } from "express";
import axios from "axios";
import { load } from "cheerio";
import createHttpError from "http-errors";
import crypto from "crypto";
import CryptoJS from "crypto-js";

// ==================== CONSTANTS ====================

const DEFAULT_HIANIME_URL = "https://hianime.to";

const Servers = {
  VidStreaming: "vidstreaming",
  MegaCloud: "megacloud",
  StreamSB: "streamsb",
  StreamTape: "streamtape",
  VidCloud: "vidcloud",
  HD1: "hd-1",
  HD2: "hd-2",
};

// ==================== URL CONFIGURATION ====================

const createURLConfig = async (websites_collection, isSiteReachable) => {
  const aniwatch = websites_collection["AniWatch"];
  let aniwatch_base = aniwatch.BASE;
  const clones_array = [aniwatch_base];

  if (aniwatch.CLONES) {
    for (const key in aniwatch.CLONES) {
      if (Object.prototype.hasOwnProperty.call(aniwatch.CLONES, key)) {
        clones_array.push(...aniwatch.CLONES[key]);
      }
    }
  }

  for (const url of clones_array) {
    if (await isSiteReachable(url)) {
      aniwatch_base = url;
      break;
    }
  }

  return {
    BASE: aniwatch_base,
    HOME: `${aniwatch_base}/home`,
    SEARCH: `${aniwatch_base}/search`,
    GENRE: `${aniwatch_base}/genre`,
    AJAX: `${aniwatch_base}/ajax`,
  };
};

// ==================== EXTRACTORS ====================

const extract_trending_animes = ($, selectors) => {
  const animes = [];
  $(selectors).each((_index, element) => {
    animes.push({
      id: $(element).find(".item .film-poster")?.attr("href")?.slice(1) || null,
      name: $(element).find(".item .number .film-title.dynamic-name")?.text()?.trim() ?? "UNKNOWN ANIME",
      img: $(element).find(".item .film-poster .film-poster-img")?.attr("data-src")?.trim() || null,
    });
  });
  return animes;
};

const extract_spotlight_animes = ($, selectors) => {
  const animes = [];
  $(selectors).each((_index, element) => {
    const animeID = $(element).find(".deslide-item-content .desi-buttons a")?.last()?.attr("href")?.slice(1)?.trim() || null;
    const animeNAME = $(element).find(".deslide-item-content .desi-head-title.dynamic-name")?.text()?.trim() ?? "UNKNOWN ANIME";
    const animeRANK = Number($(element).find(".deslide-item-content .desi-sub-text")?.text()?.trim()?.split(" ")[0]?.slice(1)) || null;
    const animeIMG = $(element).find(".deslide-cover .deslide-cover-img .film-poster-img")?.attr("data-src")?.trim() || null;
    const animeDESCRIPTION = $(element).find(".deslide-item-content .desi-description")?.text()?.split("[")?.shift()?.trim() ?? "UNKNOWN ANIME DESCRIPTION";
    const animeEXTRA = $(element).find(".deslide-item-content .sc-detail .scd-item").map((_i, el) => $(el).text().trim()).get();
    const episodeDetails = animeEXTRA[4]?.split(/\s+/).map(Number) || [null, null, null];

    animes.push({
      id: animeID,
      name: animeNAME,
      rank: animeRANK,
      img: animeIMG,
      episodes: { eps: episodeDetails[2], sub: episodeDetails[0], dub: episodeDetails[1] },
      duration: animeEXTRA[1],
      quality: animeEXTRA[3],
      category: animeEXTRA[0],
      releasedDay: animeEXTRA[2],
      description: animeDESCRIPTION,
    });
  });
  return animes;
};

const extract_latest_episodes = ($, selectors) => {
  const animes = [];
  $(selectors).each((_index, element) => {
    const animeID = $(element).find(".film-poster")?.attr("href")?.slice(1)?.trim() || null;
    const animeNAME = $(element).find(".film-detail .film-name .dynamic-name")?.text()?.trim() ?? "UNKNOWN ANIME";
    const animeIMG = $(element).find(".film-poster .film-poster-img")?.attr("data-src")?.trim() || null;
    const episodeInfo = $(element).find(".film-poster .tick-eps")?.text()?.trim() || null;
    const animeDURATION = $(element).find(".film-detail .fd-infor .fdi-duration")?.text()?.trim() || null;
    const animeRATED = $(element).find(".film-poster .tick-rate")?.text()?.trim() === "18+" ? true : false;

    animes.push({
      id: animeID,
      name: animeNAME,
      img: animeIMG,
      episodes: { eps: episodeInfo ? Number(episodeInfo.replace("Ep ", "")) : null, sub: null, dub: null },
      duration: animeDURATION,
      rated: animeRATED,
    });
  });
  return animes;
};

const extract_top10_animes = ($, period) => {
  const animes = [];
  $(`#top-viewed-${period} ul li`).each((_index, element) => {
    const animeID = $(element).find(".film-detail .dynamic-name")?.attr("href")?.slice(1) || null;
    const animeNAME = $(element).find(".film-detail .dynamic-name")?.text()?.trim() ?? "UNKNOWN ANIME";
    const animeIMG = $(element).find(".film-poster .film-poster-img")?.attr("data-src")?.trim() || null;
    const animeRANK = Number($(element).find(".film-number span")?.text()?.trim()) || null;
    const episodeInfo = $(element).find(".film-detail .fd-infor .tick-item").map((_i, el) => $(el).text().trim()).get();

    animes.push({
      id: animeID,
      name: animeNAME,
      img: animeIMG,
      rank: animeRANK,
      episodes: {
        eps: episodeInfo[2] ? Number(episodeInfo[2].replace("Ep ", "")) : null,
        sub: episodeInfo[0] ? Number(episodeInfo[0].replace("Sub: ", "")) : null,
        dub: episodeInfo[1] ? Number(episodeInfo[1].replace("Dub: ", "")) : null,
      },
    });
  });
  return animes;
};

const extract_featured_animes = ($, selectors) => {
  const animes = [];
  $(selectors).each((_index, element) => {
    const animeID = $(element).find(".film-detail .dynamic-name")?.attr("href")?.slice(1) || null;
    const animeNAME = $(element).find(".film-detail .dynamic-name")?.text()?.trim() ?? "UNKNOWN ANIME";
    const animeIMG = $(element).find(".film-poster .film-poster-img")?.attr("data-src")?.trim() || null;
    const episodeInfo = $(element).find(".film-detail .fd-infor .tick-item").map((_i, el) => $(el).text().trim()).get();

    animes.push({
      id: animeID,
      name: animeNAME,
      img: animeIMG,
      episodes: {
        eps: episodeInfo[2] ? Number(episodeInfo[2].replace("Ep ", "")) : null,
        sub: episodeInfo[0] ? Number(episodeInfo[0].replace("Sub: ", "")) : null,
        dub: episodeInfo[1] ? Number(episodeInfo[1].replace("Dub: ", "")) : null,
      },
    });
  });
  return animes;
};

const extract_top_upcoming_animes = ($, selectors) => {
  const animes = [];
  $(selectors).each((_index, element) => {
    const animeID = $(element).find(".film-poster")?.attr("href")?.slice(1)?.trim() || null;
    const animeNAME = $(element).find(".film-detail .film-name .dynamic-name")?.text()?.trim() ?? "UNKNOWN ANIME";
    const animeIMG = $(element).find(".film-poster .film-poster-img")?.attr("data-src")?.trim() || null;
    const animeDURATION = $(element).find(".film-detail .fd-infor .fdi-duration")?.text()?.trim() || null;
    const animeRATED = $(element).find(".film-poster .tick-rate")?.text()?.trim() === "18+" ? true : false;

    animes.push({
      id: animeID,
      name: animeNAME,
      img: animeIMG,
      episodes: { eps: null, sub: null, dub: null },
      duration: animeDURATION,
      rated: animeRATED,
    });
  });
  return animes;
};

const extract_genre_list = ($, selectors) => {
  const genres = [];
  $(selectors).each((_index, element) => {
    genres.push($(element).find("a")?.text()?.trim());
  });
  return genres;
};

const extract_about_info = ($, selectors) => {
  const info = {
    id: null,
    mal_id: null,
    al_id: null,
    anime_id: null,
    name: "UNKNOWN ANIME",
    img: null,
    rating: null,
    episodes: { eps: null, sub: null, dub: null },
    category: null,
    quality: null,
    duration: null,
    description: "UNKNOWN ANIME DESCRIPTION",
  };

  info.id = $(selectors).find(".anisc-detail .film-buttons a.btn-play")?.attr("href")?.split("/")?.pop() || null;
  info.name = $(selectors).find(".anisc-detail .film-name.dynamic-name")?.text()?.trim() ?? "UNKNOWN ANIME";
  info.img = $(selectors).find(".anisc-poster .film-poster .film-poster-img")?.attr("src")?.trim() || null;
  info.rating = $(selectors).find(".anisc-detail .film-stats .tick-pg")?.text()?.trim() || null;

  const episodeInfo = $(selectors).find(".anisc-detail .film-stats .tick-item").map((_i, el) => $(el).text().trim()).get();
  if (episodeInfo.length >= 3) {
    info.episodes = {
      eps: episodeInfo[2] ? Number(episodeInfo[2].replace("Ep ", "").replace(/\D/g, "")) : null,
      sub: episodeInfo[0] ? Number(episodeInfo[0].replace("Sub: ", "").replace(/\D/g, "")) : null,
      dub: episodeInfo[1] ? Number(episodeInfo[1].replace("Dub: ", "").replace(/\D/g, "")) : null,
    };
  }

  info.category = $(selectors).find(".anisc-detail .film-stats .tick:nth-child(1)")?.text()?.trim() || null;
  info.quality = $(selectors).find(".anisc-detail .film-stats .tick-quality")?.text()?.trim() || null;
  info.duration = $(selectors).find(".anisc-detail .film-stats .tick:nth-child(3)")?.text()?.trim() || null;
  info.description = $(selectors).find(".anisc-detail .film-description .text")?.text()?.trim() ?? "UNKNOWN ANIME DESCRIPTION";

  // Get MAL and AL IDs
  const syncData = $(".anisc-detail .film-buttons a.btn-play")?.attr("href");
  if (syncData) {
    const dataId = syncData.split("?")[0].split("/").pop();
    info.anime_id = dataId ? Number(dataId.split("-").pop()) : null;
  }

  $('a[href*="myanimelist.net"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const match = href.match(/myanimelist\.net\/anime\/(\d+)/);
      if (match) info.mal_id = Number(match[1]);
    }
  });

  $('a[href*="anilist.co"]').each((_, el) => {
    const href = $(el).attr("href");
    if (href) {
      const match = href.match(/anilist\.co\/anime\/(\d+)/);
      if (match) info.al_id = Number(match[1]);
    }
  });

  return info;
};

const extract_extra_about_info = ($, selectors) => {
  const moreInfo = {};
  $(selectors).find(".item").each((_index, element) => {
    const key = $(element).find(".item-head")?.text()?.replace(":", "")?.trim()?.toLowerCase()?.replace(/\s+/g, "_");
    const value = $(element).find(".name, a").map((_i, el) => $(el).text().trim()).get();
    if (key) {
      moreInfo[key] = value.length === 1 ? value[0] : value;
    }
  });
  return moreInfo;
};

const extract_anime_seasons_info = ($, selectors) => {
  const seasons = [];
  $(selectors).each((_index, element) => {
    seasons.push({
      id: $(element).attr("href")?.split("/")?.pop() || null,
      name: $(element).attr("title") || null,
      img: null,
      seasonTitle: $(element).find(".title")?.text()?.trim() || null,
      isCurrent: $(element).hasClass("active"),
    });
  });
  return seasons;
};

const extract_related_animes = ($, selectors) => {
  const animes = [];
  $(selectors).each((_index, element) => {
    animes.push({
      id: $(element).find(".film-detail .dynamic-name")?.attr("href")?.slice(1) || null,
      name: $(element).find(".film-detail .dynamic-name")?.text()?.trim() ?? "UNKNOWN ANIME",
      img: $(element).find(".film-poster .film-poster-img")?.attr("data-src")?.trim() || null,
      episodes: { eps: null, sub: null, dub: null },
      category: $(element).find(".film-detail .fd-infor .tick")?.text()?.trim() || null,
    });
  });
  return animes;
};

const extract_recommended_animes = ($, selectors) => {
  return extract_top_upcoming_animes($, selectors);
};

const extract_mostpopular_animes = ($, selectors) => {
  return extract_related_animes($, selectors);
};

const extract_searched_animes = ($, selectors) => {
  return extract_top_upcoming_animes($, selectors);
};

const extract_category_animes = ($, selectors) => {
  return extract_top_upcoming_animes($, selectors);
};

const extract_episodes_info = ($, selectors) => {
  const episodes = [];
  $(selectors).each((_index, element) => {
    episodes.push({
      name: $(element).attr("title") || null,
      episodeNo: Number($(element).attr("data-number")) || null,
      episodeId: $(element).attr("href")?.split("/")?.pop() || null,
      filler: $(element).hasClass("ssl-item-filler"),
    });
  });
  return episodes;
};

const extract_server_id = ($, serverId, category) => {
  let serverIdResult = null;
  $(`.ps_-block.ps_-block-sub.servers-${category} .ps__-list .server-item`).each((_, el) => {
    if (Number($($).find(el).attr("data-server-id")) === serverId) {
      serverIdResult = $(el).attr("data-id") || null;
    }
  });
  return serverIdResult;
};

const extract_atoz_animes = ($, selectors) => {
  return extract_top_upcoming_animes($, selectors);
};

// ==================== SCRAPERS ====================

const scrapeHomePage = async (URLs, headers) => {
  const res = {
    spotLightAnimes: [],
    trendingAnimes: [],
    latestEpisodes: [],
    top10Animes: { day: [], week: [], month: [] },
    featuredAnimes: { topAiringAnimes: [], mostPopularAnimes: [], mostFavoriteAnimes: [], latestCompletedAnimes: [] },
    topUpcomingAnimes: [],
    genres: [],
  };

  const mainPage = await axios.get(URLs.HOME, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);

  res.trendingAnimes = extract_trending_animes($, "#anime-trending #trending-home .swiper-wrapper .swiper-slide");
  res.latestEpisodes = extract_latest_episodes($, "#main-content .block_area_home:nth-of-type(1) .tab-content .film_list-wrap .flw-item");
  res.featuredAnimes.topAiringAnimes = extract_featured_animes($, "#anime-featured .row div:nth-of-type(1) .anif-block-ul ul li");
  res.featuredAnimes.mostPopularAnimes = extract_featured_animes($, "#anime-featured .row div:nth-of-type(2) .anif-block-ul ul li");
  res.featuredAnimes.mostFavoriteAnimes = extract_featured_animes($, "#anime-featured .row div:nth-of-type(3) .anif-block-ul ul li");
  res.featuredAnimes.latestCompletedAnimes = extract_featured_animes($, "#anime-featured .row div:nth-of-type(4) .anif-block-ul ul li");
  res.topUpcomingAnimes = extract_top_upcoming_animes($, "#main-content .block_area_home:nth-of-type(3) .tab-content .film_list-wrap .flw-item");
  res.spotLightAnimes = extract_spotlight_animes($, "#slider .swiper-wrapper .swiper-slide");
  res.genres = extract_genre_list($, "#main-sidebar .block_area.block_area_sidebar.block_area-genres .sb-genre-list li");

  res.top10Animes.day = extract_top10_animes($, "day");
  res.top10Animes.week = extract_top10_animes($, "week");
  res.top10Animes.month = extract_top10_animes($, "month");

  return res;
};

const scrapeAboutPage = async (id, URLs, headers) => {
  const res = {
    info: {},
    moreInfo: {},
    seasons: [],
    relatedAnimes: [],
    recommendedAnimes: [],
    mostPopularAnimes: [],
  };

  const aboutURL = new URL(id, URLs.BASE).toString();
  const mainPage = await axios.get(aboutURL, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);

  res.info = extract_about_info($, "#ani_detail .container .anis-content");
  res.moreInfo = extract_extra_about_info($, "#ani_detail .container .anis-content .anisc-info");
  res.seasons = extract_anime_seasons_info($, ".os-list a.os-item");
  res.relatedAnimes = extract_related_animes($, "#main-sidebar .block_area.block_area_sidebar.block_area-realtime:nth-of-type(1) .anif-block-ul ul li");
  res.recommendedAnimes = extract_recommended_animes($, "#main-content .block_area.block_area_category .tab-content .flw-item");
  res.mostPopularAnimes = extract_mostpopular_animes($, "#main-sidebar .block_area.block_area_sidebar.block_area-realtime:nth-of-type(2) .anif-block-ul ul li");

  return res;
};

const scrapeSearchPage = async (query, page, URLs, headers) => {
  const res = {
    animes: [],
    mostPopularAnimes: [],
    currentPage: Number(page),
    hasNextPage: false,
    totalPages: 1,
    genres: [],
  };

  const mainPage = await axios.get(`${URLs.SEARCH}?keyword=${query}&page=${page}`, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);

  res.animes = extract_searched_animes($, "#main-content .tab-content .film_list-wrap .flw-item");
  res.mostPopularAnimes = extract_mostpopular_animes($, "#main-sidebar .block_area.block_area_sidebar.block_area-realtime .anif-block-ul ul li");
  res.genres = extract_genre_list($, "#main-sidebar .block_area.block_area_sidebar.block_area-genres .sb-genre-list li");

  res.hasNextPage = $(".pagination > li").length > 0 && !$(".pagination > li").last().hasClass("active");
  res.totalPages = Number($('.pagination > .page-item a[title="Last"]')?.attr("href")?.split("=").pop()) || 
                   Number($(".pagination > .page-item.active a")?.text()?.trim()) || 1;

  return res;
};

const scrapeCategoryPage = async (category, page, URLs, headers) => {
  const res = {
    animes: [],
    top10Animes: { day: [], week: [], month: [] },
    category,
    genres: [],
    currentPage: Number(page),
    hasNextPage: false,
    totalPages: 1,
  };

  const scrapeUrl = new URL(category, URLs.BASE);
  const mainPage = await axios.get(`${scrapeUrl}?page=${page}`, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);

  res.category = $("#main-content .block_area .block_area-header .cat-heading")?.text()?.trim() ?? category;
  res.animes = extract_category_animes($, "#main-content .tab-content .film_list-wrap .flw-item");
  res.genres = extract_genre_list($, "#main-sidebar .block_area.block_area_sidebar.block_area-genres .sb-genre-list li");

  res.hasNextPage = $(".pagination > li").length > 0 && !$(".pagination > li").last().hasClass("active");
  res.totalPages = Number($('.pagination > .page-item a[title="Last"]')?.attr("href")?.split("=").pop()) ||
                   Number($(".pagination > .page-item.active a")?.text()?.trim()) || 1;

  res.top10Animes.day = extract_top10_animes($, "day");
  res.top10Animes.week = extract_top10_animes($, "week");
  res.top10Animes.month = extract_top10_animes($, "month");

  return res;
};

const scrapeEpisodesPage = async (animeId, URLs, headers) => {
  const res = { totalEpisodes: 0, episodes: [] };

  const episodes = await axios.get(`${URLs.AJAX}/v2/episode/list/${animeId.split("-").pop()}`, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "X-Requested-With": "XMLHttpRequest",
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
      Referer: `${URLs.BASE}/watch/${animeId}`,
    },
  });

  const $ = load(episodes.data.html);
  res.totalEpisodes = Number($(".detail-infor-content .ss-list a").length);
  res.episodes = extract_episodes_info($, ".detail-infor-content .ss-list a");

  return res;
};

const scrapeEpisodeServersPage = async (episodeId, URLs, headers) => {
  const res = { episodeId, episodeNo: 0, sub: [], dub: [], raw: [] };

  const epId = episodeId.split("?ep=")[1];
  const { data } = await axios.get(`${URLs.AJAX}/v2/episode/servers?episodeId=${epId}`, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "X-Requested-With": "XMLHttpRequest",
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
      Referer: new URL(`/watch/${episodeId}`, URLs.BASE).href,
    },
  });

  const $ = load(data.html);
  res.episodeNo = Number($(".server-notice strong").text().split(" ").pop()) || 0;

  $(`.ps_-block.ps_-block-sub.servers-sub .ps__-list .server-item`).each((_, el) => {
    res.sub.push({
      serverName: $(el).find("a").text().toLowerCase().trim(),
      serverId: Number($(el)?.attr("data-server-id")?.trim()) || null,
    });
  });

  $(`.ps_-block.ps_-block-sub.servers-dub .ps__-list .server-item`).each((_, el) => {
    res.dub.push({
      serverName: $(el).find("a").text().toLowerCase().trim(),
      serverId: Number($(el)?.attr("data-server-id")?.trim()) || null,
    });
  });

  $(`.ps_-block.ps_-block-sub.servers-raw .ps__-list .server-item`).each((_, el) => {
    res.raw.push({
      serverName: $(el).find("a").text().toLowerCase().trim(),
      serverId: Number($(el)?.attr("data-server-id")?.trim()) || null,
    });
  });

  return res;
};

const scrapeatozAnimes = async (page, URLs, headers) => {
  const scrapeUrl = new URL("az-list", URLs.BASE);
  const mainPage = await axios.get(`${scrapeUrl}/?page=${page}`, {
    headers: {
      "User-Agent": headers.USER_AGENT_HEADER,
      "Accept-Encoding": headers.ACCEPT_ENCODEING_HEADER,
      Accept: headers.ACCEPT_HEADER,
    },
  });

  const $ = load(mainPage.data);
  return extract_atoz_animes($, "#main-wrapper div div.page-az-wrap section div.tab-content div div.film_list-wrap .flw-item");
};

// ==================== VIDEO EXTRACTORS (SIMPLIFIED) ====================

// MegaCloud extractor (simplified version)
class MegaCloud {
  constructor() {
    this.serverName = "MegaCloud";
    this.sources = [];
  }

  async extract(videoUrl) {
    const result = { sources: [], subtitles: [] };
    
    try {
      const videoId = videoUrl?.href?.split("/")?.pop()?.split("?")[0];
      const response = await axios.get(`https://megacloud.tv/embed-2/ajax/e-1/getSources?id=${videoId}`, {
        headers: {
          Accept: "*/*",
          "X-Requested-With": "XMLHttpRequest",
          "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/121.0.0.0 Safari/537.36",
          Referer: videoUrl.href,
        },
      });

      const srcsData = response.data;
      if (!srcsData) throw new Error("Invalid video id");

      if (!srcsData.encrypted && Array.isArray(srcsData.sources)) {
        result.intro = srcsData.intro;
        result.outro = srcsData.outro;
        result.subtitles = (srcsData.tracks || []).map((s) => ({
          url: s.file,
          lang: s.label || "Thumbnails",
        }));
        result.sources = srcsData.sources.map((s) => ({
          url: s.file,
          type: s.type,
          isM3U8: s.file.includes(".m3u8"),
        }));
        return result;
      }

      // For encrypted sources, attempt decryption
      const scriptData = await axios.get(`https://megacloud.tv/js/player/a/prod/e1-player.min.js?v=${Date.now()}`);
      const text = scriptData.data;
      
      const vars = this.extractVariables(text);
      const { secret, encryptedSource } = this.getSecret(srcsData.sources, vars);
      const decrypted = this.decrypt(encryptedSource, secret);
      
      const sources = JSON.parse(decrypted);
      result.intro = srcsData.intro;
      result.outro = srcsData.outro;
      result.subtitles = (srcsData.tracks || []).map((s) => ({
        url: s.file,
        lang: s.label || "Thumbnails",
      }));
      result.sources = sources.map((s) => ({
        url: s.file,
        type: s.type,
        isM3U8: s.file.includes(".m3u8"),
      }));

      return result;
    } catch (err) {
      console.error("MegaCloud extraction error:", err.message);
      throw err;
    }
  }

  extractVariables(text) {
    const regex = /case\s*0x[0-9a-f]+:(?![^;]*=partKey)\s*\w+\s*=\s*(\w+)\s*,\s*\w+\s*=\s*(\w+);/g;
    const matches = text.matchAll(regex);
    return Array.from(matches, (match) => {
      const matchKey1 = this.matchingKey(match[1], text);
      const matchKey2 = this.matchingKey(match[2], text);
      try {
        return [parseInt(matchKey1, 16), parseInt(matchKey2, 16)];
      } catch (e) {
        return [];
      }
    }).filter((pair) => pair.length > 0);
  }

  getSecret(encryptedString, values) {
    let secret = "", encryptedSource = "";
    const encryptedSourceArray = encryptedString.split("");
    let currentIndex = 0;

    for (const index of values) {
      const start = index[0] + currentIndex;
      const end = start + index[1];
      for (let i = start; i < end; i++) {
        secret += encryptedString[i];
        encryptedSourceArray[i] = "";
      }
      currentIndex += index[1];
    }

    encryptedSource = encryptedSourceArray.join("");
    return { secret, encryptedSource };
  }

  decrypt(encrypted, keyOrSecret) {
    const cypher = Buffer.from(encrypted, "base64");
    const salt = cypher.subarray(8, 16);
    const password = Buffer.concat([Buffer.from(keyOrSecret, "binary"), salt]);
    const md5Hashes = [];
    let digest = password;
    for (let i = 0; i < 3; i++) {
      md5Hashes[i] = crypto.createHash("md5").update(digest).digest();
      digest = Buffer.concat([md5Hashes[i], password]);
    }
    const key = Buffer.concat([md5Hashes[0], md5Hashes[1]]);
    const iv = md5Hashes[2];
    const contents = cypher.subarray(16);

    const decipher = crypto.createDecipheriv("aes-256-cbc", key, iv);
    return decipher.update(contents, undefined, "utf8") + decipher.final();
  }

  matchingKey(value, script) {
    const regex = new RegExp(`,${value}=((?:0x)?([0-9a-fA-F]+))`);
    const match = script.match(regex);
    if (match) return match[1].replace(/^0x/, "");
    throw new Error("Failed to match the key");
  }

  async extract2(embedIframeURL) {
    return this.extract(embedIframeURL);
  }
}

// ==================== EPISODE SOURCES SCRAPER ====================

const scrapeAnimeEpisodeSources = async (episodeId, server = Servers.VidStreaming, category = "sub", URLs, headers) => {
  if (episodeId.startsWith("http")) {
    const serverUrl = new URL(episodeId);
    const megacloud = new MegaCloud();
    
    switch (server) {
      case Servers.MegaCloud:
      case Servers.VidStreaming:
      case Servers.VidCloud:
        return await megacloud.extract2(serverUrl);
      default:
        return await megacloud.extract(serverUrl);
    }
  }

  const epId = new URL(`/watch/${episodeId}`, URLs.BASE).href;
  
  const resp = await axios.get(`${URLs.AJAX}/v2/episode/servers?episodeId=${epId.split("?ep=")[1]}`, {
    headers: {
      Referer: epId,
      "User-Agent": headers.USER_AGENT_HEADER,
      "X-Requested-With": "XMLHttpRequest",
    },
  });

  const $ = load(resp.data.html);
  
  let serverId = null;
  const serverMap = {
    [Servers.MegaCloud]: 1,
    [Servers.VidCloud]: 1,
    [Servers.HD2]: 1,
    [Servers.VidStreaming]: 4,
    [Servers.HD1]: 4,
    [Servers.StreamSB]: 5,
    [Servers.StreamTape]: 3,
  };

  const serverNum = serverMap[server];
  if (serverNum) {
    $(`.ps_-block.ps_-block-sub.servers-${category} .ps__-list .server-item`).each((_, el) => {
      if (Number($(el).attr("data-server-id")) === serverNum) {
        serverId = $(el).attr("data-id") || null;
      }
    });
  }

  if (!serverId) {
    throw createHttpError.NotFound("Couldn't find server. Try another server");
  }

  const { data: { link } } = await axios.get(`${URLs.AJAX}/v2/episode/sources?id=${serverId}`);
  return await scrapeAnimeEpisodeSources(link, server, category, URLs, headers);
};

// ==================== ROUTER FACTORY ====================

export const createAniwatchRouter = ({ cacheManager, createResponse, asyncHandler, headers, websites_collection, isSiteReachable }) => {
  const router = Router();
  let URLsCache = null;

  const getURLs = async () => {
    if (!URLsCache) {
      URLsCache = await createURLConfig(websites_collection, isSiteReachable);
    }
    return URLsCache;
  };

  // Home page
  router.get("/", cacheManager.middleware(), asyncHandler(async (req, res) => {
    const URLs = await getURLs();
    const data = await scrapeHomePage(URLs, headers);
    res.json(createResponse(true, data));
  }));

  // A-Z List
  router.get("/az-list", cacheManager.middleware({ duration: 3600 * 24, keyParams: ["page"] }), asyncHandler(async (req, res) => {
    const page = Number(req.query.page) || 1;
    const URLs = await getURLs();
    const data = await scrapeatozAnimes(page, URLs, headers);
    res.json(createResponse(true, data, null, { page }));
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
  router.get("/anime/:id", cacheManager.middleware({ duration: 3600 * 24 * 31 }), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const URLs = await getURLs();
    const data = await scrapeAboutPage(id, URLs, headers);
    res.json(createResponse(true, data));
  }));

  // Episodes list
  router.get("/episodes/:id", cacheManager.middleware({ duration: 3600 * 24 }), asyncHandler(async (req, res) => {
    const { id } = req.params;
    const URLs = await getURLs();
    const data = await scrapeEpisodesPage(id, URLs, headers);
    res.json(createResponse(true, data));
  }));

  // Episode servers
  router.get("/servers", cacheManager.middleware(), asyncHandler(async (req, res) => {
    const { id } = req.query;
    if (!id) {
      return res.status(400).json(createResponse(false, null, { message: "id parameter is required", code: "MISSING_PARAM", status: 400 }));
    }
    const URLs = await getURLs();
    const data = await scrapeEpisodeServersPage(id, URLs, headers);
    res.json(createResponse(true, data));
  }));

  // Episode sources
  router.get("/episode-srcs", cacheManager.middleware({ duration: 1800, keyParams: ["id", "category", "server"] }), asyncHandler(async (req, res) => {
    const { id, server = "vidstreaming", category = "sub" } = req.query;
    if (!id) {
      return res.status(400).json(createResponse(false, null, { message: "id parameter is required", code: "MISSING_PARAM", status: 400 }));
    }
    const URLs = await getURLs();
    const data = await scrapeAnimeEpisodeSources(id, server, category, URLs, headers);
    res.json(createResponse(true, data));
  }));

  // Category pages (must be last due to :category param)
  router.get("/:category", cacheManager.middleware({ duration: 3600 * 24, keyParams: ["page"] }), asyncHandler(async (req, res) => {
    const { category } = req.params;
    const page = Number(req.query.page) || 1;
    const URLs = await getURLs();
    const data = await scrapeCategoryPage(category, page, URLs, headers);
    res.json(createResponse(true, data));
  }));

  return router;
};

export { Servers, DEFAULT_HIANIME_URL };
