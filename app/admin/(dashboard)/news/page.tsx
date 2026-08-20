import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { NewsArticleForm } from "@/components/admin/news-article-form";
import { NewsStatusControl } from "@/components/admin/news-status-control";
import { DeleteButton } from "@/components/admin/delete-button";

export const dynamic = "force-dynamic";

export default async function AdminNewsPage() {
  const articles = await prisma.newsArticle.findMany({ orderBy: { createdAt: "desc" } });

  return (
    <>
      <h1>News</h1>
      <NewsArticleForm />

      <table className="admin-table">
        <thead>
          <tr>
            <th>Title</th>
            <th>Summary</th>
            <th>Status</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {articles.map((article) => (
            <tr key={article.id}>
              <td>{article.title}</td>
              <td>{article.summary}</td>
              <td>
                <NewsStatusControl articleId={article.id} status={article.status} />
              </td>
              <td>
                <Link href={`/admin/news/${article.id}/edit`}>Edit</Link>{" "}
                <DeleteButton endpoint={`/api/admin/news/${article.id}`} confirmLabel={article.title} />
              </td>
            </tr>
          ))}
          {articles.length === 0 ? (
            <tr>
              <td colSpan={4}>No articles yet.</td>
            </tr>
          ) : null}
        </tbody>
      </table>
    </>
  );
}
