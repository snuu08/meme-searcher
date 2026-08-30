const TREND_CONFIG = {
  platforms: ["youtube", "tiktok", "instagram"],
  risingScore: 75,
  popularScore: 60,
  newHours: 6,
  minAgeHours: 1,

  memeScoreWeights: {
    growthVelocity: 0.3,
    acceleration: 0.2,
    share: 0.15,
    engagement: 0.15,
    creatorSpread: 0.1,
    crossPlatform: 0.1
  },

  platformWeights: {
    tiktok: {
      viewVelocity: 0.3,
      acceleration: 0.2,
      shareVelocity: 0.15,
      shareRate: 0.15,
      commentRate: 0.1,
      likeRate: 0.1
    },
    youtube: {
      viewVelocity: 0.4,
      acceleration: 0.25,
      likeRate: 0.2,
      commentRate: 0.15
    },
    instagram: {
      likeVelocity: 0.45,
      commentVelocity: 0.3,
      likeRate: 0.15,
      commentRate: 0.1
    }
  },

  seedQueries: ["meme", "viral meme", "밈"],
  seedHashtags: ["meme", "viral", "밈"],
  countryQueries: {
    korea: ["밈", "유행", "챌린지"],
    japan: ["ミーム", "流行", "チャレンジ"],
    china: ["网络迷因", "梗", "挑战"],
    us: ["meme", "viral meme", "challenge"]
  },
  countryHashtags: {
    korea: ["밈", "유행"],
    japan: ["ミーム", "流行"],
    china: ["网络迷因", "梗"],
    us: ["meme", "viral"]
  },
  memeTerms: ["meme", "viral", "trend", "challenge", "funny", "밈", "유행", "챌린지", "웃긴"],

  youtubeRegionMap: {
    global: null,
    us: "US",
    korea: "KR",
    japan: "JP",
    china: null
  },

  youtubeLanguageMap: {
    global: null,
    us: "en",
    korea: "ko",
    japan: "ja",
    china: "zh-Hans"
  },

  tiktokRegionMap: {
    global: null,
    us: "US",
    korea: "KR",
    japan: "JP",
    china: "CN"
  },

  discoveryCountries: ["korea", "japan", "china", "us"],
  homepageMix: {
    korea: 0.5,
    japan: 0.2,
    china: 0.1,
    other: 0.2
  },
  homepageLimit: 24,
  videoExamplesPerMeme: 6,
  minCountryCohort: 3,

  limits: {
    youtubePopular: 20,
    youtubeSearchPerQuery: 10,
    youtubeMaxQueries: 4,
    igMediaPerTag: 20,
    igMaxHashtags: 5,
    tiktokMaxResults: 20,
    tiktokMaxQueries: 3,
    extraKeywords: 4
  }
};

module.exports = { TREND_CONFIG };
