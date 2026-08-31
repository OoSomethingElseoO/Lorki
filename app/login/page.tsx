import { PageTitle } from "@/components/page-title";
import { SiteHeader } from "@/components/site-header";
import { Footer } from "@/components/footer";
import { LoginForm } from "@/components/login-form";

export default function LoginPage() {
  return (
    <>
      <SiteHeader />
      <main className="page-main" id="main-content">
        <PageTitle>Sign In</PageTitle>
        <div className="auth-layout">
          <div className="auth-layout__panel">
            <img
              src="/artwork/featured-original.png"
              alt=""
              className="auth-layout__panel-image"
            />
            <div className="auth-layout__panel-copy">
              <p className="auth-layout__panel-quote">Original artwork, collected with care.</p>
              <p className="auth-layout__panel-caption">
                Sign in to track your orders and see the impact your collection is funding.
              </p>
            </div>
          </div>
          <div className="auth-layout__form">
            <LoginForm />
          </div>
        </div>
      </main>
      <Footer />
    </>
  );
}
