import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { NewsArticleForm } from "@/components/admin/news-article-form";
import { NewsStatusControl } from "@/components/admin/news-status-control";
import { DeleteButton } from "@/components/admin/delete-button";
import { AdminSearchForm } from "@/components/admin/search-form";
import { Pagination } from "@/components/pagination";
import { ADMIN_PAGE_SIZE, adminTotalPages, normalizeAdminPage } from "@/lib/admin-list";

export const dynamic = "force-dynamic";

type PageProps = { searchParams: Promise<{ page?: string; q?: string }> };

export default async function AdminNewsPage({ searchParams }: PageProps) {
  const { page, q } = await searchParams;
  const currentPage = normalizeAdminPage(page);
  const query = q?.trim();

  const where = query
    ? {
        OR: [
          { title: { contains: query, mode: "insensitive" as const } },
          { summary: { contains: query, mode: "insensitive" as const } },
        ],
      }
    : {};

  const [articles, totalCount] = await Promise.all([
    prisma.newsArticle.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (currentPage - 1) * ADMIN_PAGE_SIZE,
      take: ADMIN_PAGE_SIZE,
    }),
    prisma.newsArticle.count({ where }),
  ]);

  return (
    <>
      <h1>News</h1>
      <NewsArticleForm />

      <AdminSearchForm placeholder="Search by title or summary" defaultValue={query} />

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
              <td colSpan={4}>{query ? `No articles match "${query}".` : "No articles yet."}</td>
            </tr>
          ) : null}
        </tbody>
      </table>

      <Pagination
        page={currentPage}
        totalPages={adminTotalPages(totalCount)}
        basePath="/admin/news"
        extraQuery={query ? `q=${encodeURIComponent(query)}` : undefined}
      />
    </>
  );
}
