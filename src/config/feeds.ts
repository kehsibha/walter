export type RssFeed = {
  name: string;
  url: string;
};

// Curated, demo-oriented list. These are public RSS endpoints; some outlets require subscriptions for full text.
export const FEEDS: RssFeed[] = [
  { name: "Reuters", url: "https://feeds.reuters.com/reuters/topNews" },
  { name: "AP", url: "https://apnews.com/apf-topnews?output=rss" },
  { name: "NPR", url: "https://feeds.npr.org/1001/rss.xml" },
  { name: "BBC", url: "https://feeds.bbci.co.uk/news/rss.xml" },
  { name: "Al Jazeera", url: "https://www.aljazeera.com/xml/rss/all.xml" },
  { name: "Politico", url: "https://www.politico.com/rss/politics08.xml" },
  { name: "The Hill", url: "https://thehill.com/feed/" },
  { name: "Bloomberg", url: "https://www.bloomberg.com/feed/podcast/etf-report.xml" }
];

