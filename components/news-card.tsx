import Link from "next/link";

type NewsCardProps = {
  article: {
    slug: string;
    title: string;
    summary: string;
    imageUrl: string;
  };
};

export function NewsCard({ article }: NewsCardProps) {
  return (
    <article className="news-card">
      <img src={article.imageUrl} alt="" className="news-card__image" />
      <div className="news-card__body">
        <h2>{article.title}</h2>
        <p>{article.summary}</p>
        <Link href={`/news/${article.slug}`} aria-label={`Read more about ${article.title}`}>
          Read more
        </Link>
      </div>
    </article>
  );
}
