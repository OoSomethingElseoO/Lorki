import { NewsCard } from "@/components/news-card";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { newsArticles } from "@/data/site-data";

export default function NewsPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>News</PageTitle>
        <section className="news-list" aria-label="News articles">
          {newsArticles.map((article) => (
            <NewsCard article={article} key={article.id} />
          ))}
        </section>
      </main>
    </>
  );
}
