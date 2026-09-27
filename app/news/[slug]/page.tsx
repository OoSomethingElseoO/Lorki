import Link from "next/link";
import { notFound } from "next/navigation";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { buttonVariants } from "@/components/ui/button";
import { getLiveNewsArticleBySlug } from "@/lib/storefront";
import { FallbackImage } from "@/components/ui/fallback-image";
import { absoluteOrRelative, publicMetadata, imageUrlForSchema } from "@/lib/seo";
import { StructuredData } from "@/components/structured-data";

type NewsArticlePageProps = {
  params: Promise<{ slug: string }>;
};

export async function generateMetadata({ params }: NewsArticlePageProps) {
  const { slug } = await params;
  const article = await getLiveNewsArticleBySlug(slug);
  if (!article) return {};
  return publicMetadata({
    title: `${article.title} | Lorki Originals`,
    description: article.summary,
    pathname: `/news/${encodeURIComponent(article.slug)}`,
    image: article.imageUrl,
    type: "article",
    publishedTime: article.createdAt,
  });
}

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
        <StructuredData data={{
          "@context": "https://schema.org",
          "@type": "Article",
          headline: article.title,
          description: article.summary,
          image: imageUrlForSchema(article.imageUrl),
          datePublished: article.createdAt.toISOString(),
          author: { "@type": "Organization", name: "Lorki Originals" },
          mainEntityOfPage: absoluteOrRelative(`/news/${article.slug}`),
        }} />
        <article className="news-article">
          <FallbackImage src={article.imageUrl} alt="" className="news-article__image" />
          <div className="news-article__body">
            <h1>{article.title}</h1>
            <p className="news-article__summary">{article.summary}</p>
            <p>{article.body}</p>
            <Link href="/news" className={buttonVariants()}>
              Back to news
            </Link>
          </div>
        </article>
      </main>
      <Footer />
    </>
  );
}
