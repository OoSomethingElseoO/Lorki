import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { getLiveNewsArticleBySlug } from "@/lib/storefront";

type NewsArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export default async function NewsArticlePage({ params }: NewsArticlePageProps) {
  const { slug } = await params;
  const article = await getLiveNewsArticleBySlug(slug);

  if (!article) {
    notFound();
  }

  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <article className="news-article">
          <img src={article.imageUrl} alt="" className="news-article__image" />
          <div className="news-article__body">
            <h1>{article.title}</h1>
            <p className="news-article__summary">{article.summary}</p>
            <p>{article.body}</p>
            <Link href="/news" className="button-link">
              Back to news
            </Link>
          </div>
        </article>
      </main>
    </>
  );
}
