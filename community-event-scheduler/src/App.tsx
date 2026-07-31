import SchedulePage from "./pages/SchedulePage";
import ManagePage from "./pages/ManagePage";
import AdminPage from "./pages/AdminPage";

export default function App() {
  const path = typeof window === "undefined" ? "/" : window.location.pathname;
  const content = path === "/admin"
    ? <AdminPage />
    : path.startsWith("/manage/")
      ? <ManagePage token={decodeURIComponent(path.slice("/manage/".length))} />
      : <SchedulePage />;

  return (
    <>
      <header className="site-header">
        <div className="header-inner">
          <a className="brand" href="/" aria-label="Pet Supplies Plus Battle Creek community events home">
            <span className="logo-space">
              <img src="/brand/psp-logo-stack-notag-pms354.png" width="162" height="100" alt="Pet Supplies Plus" />
            </span>
            <span className="brand-copy">
              <strong>Battle Creek Community Events</strong>
              <span>Reserve our neighborhood event space</span>
            </span>
          </a>
          <nav aria-label="Main navigation">
            <a className={path === "/" ? "active" : ""} href="/">Schedule</a>
            <a className={path === "/admin" ? "active" : ""} href="/admin">Staff</a>
          </nav>
        </div>
      </header>
      <main id="main-content">
        {content}
      </main>
      <footer>
        <div>
          <strong>Pet Supplies Plus Battle Creek</strong>
          <span>1791 W. Columbia Ave., Battle Creek, MI 49015</span>
        </div>
        <p>Community scheduling made simple — minus the hassle.</p>
      </footer>
    </>
  );
}
