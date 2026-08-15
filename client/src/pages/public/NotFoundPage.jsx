import { Link } from 'react-router-dom';

export function NotFoundPage() {
  return (
    <section className="page-section narrow">
      <div className="page-kicker">404</div>
      <h1>Page not found</h1>
      <p>The requested route is not available in the current phase.</p>
      <Link className="text-link" to="/">
        Return to EVOQ
      </Link>
    </section>
  );
}
