import Link from "next/link";
import products from "@/data/products.json";

export default function Home() {
  return (
    <main className="portfolio-page">
      <header className="portfolio-nav shell">
        <div className="portfolio-brand"><span className="brand-dot" />my-upwork</div>
        <div className="portfolio-meta">8 web products · 2026 collection</div>
      </header>
      <section className="portfolio-hero shell">
        <div><p className="eyebrow">Selected digital products</p><h1>Eight industries.<br/><span>Eight visual systems.</span></h1></div>
        <p className="portfolio-intro">A portfolio built to demonstrate range: growth, AI, SaaS, property, hospitality, commerce, creative work and finance—without recycling one template.</p>
      </section>
      <section className="project-grid shell" aria-label="Portfolio projects">
        {products.map((product, index) => (
          <Link className={"project-card project-" + product.tone} href={"/work/" + product.slug} key={product.slug}>
            <div className="project-card-top"><span>{String(index + 1).padStart(2, "0")}</span><span>{product.category}</span></div>
            <div className="project-art" aria-hidden="true"><span className="art-orb" style={{"--accent": product.accent} as React.CSSProperties} /><span className="art-line" /></div>
            <div className="project-card-copy"><h2>{product.name}</h2><p>{product.tagline}</p><span className="view-link">Open case demo ↗</span></div>
          </Link>
        ))}
      </section>
      <footer className="portfolio-footer shell"><span>Built as an original showcase.</span><span>Responsive · Accessible · Static export</span></footer>
    </main>
  );
}
