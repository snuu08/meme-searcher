const TREND_CONFIG = {
  risingScore: 75,
  popularScore: 60,
  newHours: 6,
  minAgeHours: 1,

  memeScoreWeights: {
    growthVelocity: 0.35,
    share: 0.25,
    engagement: 0.15,
    creatorSpread: 0.15,
    crossPlatform: 0.1
  },

  platformWeights: {
    tiktok: {
      viewVelocity: 0.4,
      shareVelocity: 0.3,
      shareRate: 0.15,
      commentRate: 0.1,
      likeRate: 0.05
    },
    youtube: {
      viewVelocity: 0.5,
      likeRate: 0.25,
      commentRate: 0.25
    },
    x: {
      impressionVelocity: 0.4,
      shareVelocity: 0.3,
      replyRate: 0.2,
      likeRate: 0.1
    },
    instagram: {
      likeVelocity: 0.4,
      commentVelocity: 0.3,
      likeRate: 0.15,
      commentRate: 0.15
    }
  },

  seedQueries: ["meme", "viral meme", "밈"],
  seedHashtags: ["meme", "viral", "밈"],

  regionMap: {
    global: null,
    us: "US",
    korea: "KR",
    japan: "JP",
    china: null
  },

  limits: {
    youtubePopular: 20,
    youtubeSearchPerQuery: 10,
    youtubeMaxQueries: 4,
    xMaxResults: 20,
    xMaxQueries: 4,
    igMediaPerTag: 20,
    igMaxHashtags: 5,
    tiktokMaxResults: 20,
    tiktokMaxQueries: 3,
    extraKeywords: 4
  }
};

module.exports = { TREND_CONFIG };
