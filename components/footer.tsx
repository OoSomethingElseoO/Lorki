import Link from "next/link";
import { menuLinks } from "@/lib/nav-links";
import { getBranding } from "@/lib/settings";

export async function Footer() {
  const { siteName, contactEmail, contactPhone } = await getBranding();
  const year = new Date().getFullYear();

  return (
    <footer className="site-footer">
      <div className="site-footer__inner">
        <div className="site-footer__brand">
          <p className="site-footer__wordmark">{siteName}</p>
          <p className="site-footer__tagline">Original artwork, collected with care.</p>
        </div>

        <nav className="site-footer__sitemap" aria-label="Footer">
          <p className="site-footer__heading">Explore</p>
          <ul>
            {menuLinks.map((link) => (
              <li key={link.href}>
                <Link href={link.href}>{link.label}</Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="site-footer__contact">
          <p className="site-footer__heading">Contact</p>
          <p>
            <a href={`mailto:${contactEmail}`}>{contactEmail}</a>
          </p>
          <p>{contactPhone}</p>
        </div>
      </div>

      <div className="site-footer__bottom">
        <p>
          © {year} {siteName}. All rights reserved.
        </p>
      </div>
    </footer>
  );
}
