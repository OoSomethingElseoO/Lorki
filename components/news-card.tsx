import type { NewsArticle } from "@/data/site-data";

type NewsCardProps = {
  article: NewsArticle;
};

export function NewsCard({ article }: NewsCardProps) {
  return (
    <article className="news-card">
      <img src={article.image} alt={article.alt} className="news-card__image" />
      <div className="news-card__body">
        <h2>{article.title}</h2>
        <p>{article.summary}</p>
        <a href={`/news#${article.id}`} aria-label={`Read more about ${article.title}`}>
          Read more
        </a>
      </div>
    </article>
  );
}
