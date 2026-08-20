import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { NewsArticleForm } from "@/components/admin/news-article-form";

type EditNewsPageProps = {
  params: Promise<{ id: string }>;
};

export default async function AdminEditNewsPage({ params }: EditNewsPageProps) {
  const { id } = await params;

  const article = await prisma.newsArticle.findUnique({ where: { id } });

  if (!article) {
    notFound();
  }

  return (
    <>
      <h1>Edit {article.title}</h1>
      <NewsArticleForm
        id={article.id}
        initial={{
          title: article.title,
          summary: article.summary,
          body: article.body,
          imageUrl: article.imageUrl,
        }}
      />
    </>
  );
}
