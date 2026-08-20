import { NewsCard } from "@/components/news-card";
import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { getLiveNewsArticles } from "@/lib/storefront";

export const dynamic = "force-dynamic";

export default async function NewsPage() {
  const articles = await getLiveNewsArticles();

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>News</PageTitle>
        <section className="news-list" aria-label="News articles">
          {articles.map((article) => (
            <NewsCard article={article} key={article.id} />
          ))}
        </section>
        {articles.length === 0 ? <p className="centered-copy">No news yet — check back soon.</p> : null}
      </main>
    </>
  );
}
