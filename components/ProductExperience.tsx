"use client";

import Link from "next/link";

type Product = {
  slug: string;
  name: string;
  category: string;
  tagline: string;
  summary: string;
  accent: string;
  tone: string;
  services: string[];
  proof: string[];
};

function SignatureVisual({ tone }: { tone: string }) {
  if (tone === "chain") {
    return <div className="signature chain-signature"><div className="sig-head"><span>Campaign velocity</span><span>30 days</span></div><strong>+184%</strong><small>Qualified community growth</small><div className="sig-bars">{[22,38,31,55,70,63,84,96].map((h,i)=><i key={i} style={{height:h+"%"}} />)}</div><b className="float-chip chip-one">CAC −31.8%</b><b className="float-chip chip-two">24,960 activations</b></div>;
  }
  if (tone === "orbit") {
    return <div className="signature orbit-signature"><div className="node n1">Intake</div><div className="connector c1"/><div className="node n2">Classify</div><div className="connector c2"/><div className="node n3">Human check</div><div className="connector c3"/><div className="node n4">Ship</div><pre>09:42:11  matched invoice{"\n"}09:42:14  approval requested{"\n"}09:44:07  workflow completed</pre></div>;
  }
  if (tone === "metric") {
    return <div className="signature metric-signature"><div className="metric-tabs"><b>Pipeline</b><span>Retention</span><span>Expansion</span></div><strong>$3.84M <small>+18.6%</small></strong><div className="metric-bars">{[42,55,49,66,72,63,78,91,86,98].map((h,i)=><i key={i} style={{height:h+"%"}} />)}</div><div className="metric-line"><span>Enterprise</span><b>$1.92M</b><em>50%</em></div><div className="metric-line"><span>Mid-market</span><b>$1.18M</b><em>31%</em></div></div>;
  }
  if (tone === "maison") {
    return <div className="signature maison-signature"><div className="maison-window"/><span>36 Quai de Béthune · Paris</span></div>;
  }
  if (tone === "noma") {
    return <div className="signature noma-signature"><div className="plate"><div className="cup"><span /></div></div><div className="receipt">NOMA DAILY<br/>Filter coffee · 65<br/>Cardamom bun · 48</div></div>;
  }
  if (tone === "aura") {
    return <div className="signature aura-signature"><div className="vase"><span /></div><small>Hand-thrown vessel · Clay 02</small></div>;
  }
  if (tone === "northstar") {
    return <div className="signature northstar-signature"><span>CASE 04</span><strong>NO<br/>CLONES.</strong><i>↗</i></div>;
  }
  return <div className="signature ledger-signature"><div className="ledger-head"><span>Treasury overview</span><b>$24,842,610</b></div><svg viewBox="0 0 600 180" preserveAspectRatio="none"><path d="M0 140 C55 135,80 90,125 108 S205 123,250 74 S330 94,365 55 S460 71,505 38 S560 45,600 18" fill="none" stroke="currentColor" strokeWidth="5"/></svg><div className="ledger-row"><span>BTC</span><b>$6.4M</b><em>+2.84%</em></div><div className="ledger-row"><span>ETH</span><b>$4.7M</b><em>+1.91%</em></div></div>;
}

const subheads: Record<string,string> = {
  chain: "Crypto growth, without the hype",
  orbit: "AI operations studio",
  metric: "Revenue intelligence",
  maison: "Private collection · 2026",
  noma: "Neighborhood coffee & bakery",
  aura: "Edition 04 — objects for home",
  northstar: "Independent design & build studio",
  ledger: "Treasury & portfolio operations",
};

const sectionTitles: Record<string,string> = {
  chain: "A growth stack built around real adoption.",
  orbit: "Automation should feel boringly reliable.",
  metric: "Every team sees the same revenue truth.",
  maison: "A small collection, considered deeply.",
  noma: "The menu changes with the morning.",
  aura: "Made slowly. Kept for longer.",
  northstar: "Strategy, identity and product in one room.",
  ledger: "Dense information without dense interaction.",
};

export default function ProductExperience({ product }: { product: Product }) {
  return (
    <main className={"demo-page theme-" + product.tone} style={{"--accent":product.accent} as React.CSSProperties}>
      <header className="demo-nav shell">
        <Link className="demo-back" href="/">← Portfolio</Link>
        <div className="demo-logo">{product.name}</div>
        <a className="demo-cta" href="#contact">Start a project</a>
      </header>

      <section className="demo-hero shell">
        <div className="hero-copy">
          <p className="demo-kicker">{subheads[product.tone]}</p>
          <h1>{product.tagline}</h1>
          <p className="demo-summary">{product.summary}</p>
          <div className="hero-actions"><a className="hero-primary" href="#work">Explore the work</a><a className="hero-secondary" href="#contact">Discuss a project ↗</a></div>
        </div>
        <SignatureVisual tone={product.tone} />
      </section>

      <section className="sector-strip">
        <div className="shell">{product.services.map((item)=><span key={item}>{item}</span>)}</div>
      </section>

      <section id="work" className="demo-section shell">
        <div className="section-heading"><p className="demo-kicker">Selected capabilities</p><h2>{sectionTitles[product.tone]}</h2></div>
        <div className="service-grid">
          {product.services.map((item,index)=><article key={item}><small>{"0"+(index+1)}</small><h3>{item}</h3><p>{["Positioning and experience shaped around the real user decision.","A focused interaction model with clear states and a confident visual hierarchy.","Built responsive-first with production-minded accessibility and content structure."][index]}</p></article>)}
        </div>
      </section>

      <section className="proof-section shell">
        <div><p className="demo-kicker">Signals</p><h2>Proof, not decoration.</h2></div>
        <div className="proof-grid">{product.proof.map((item,index)=><article key={item}><span>{String(index+1).padStart(2,"0")}</span><strong>{item}</strong><small>Portfolio demonstration value</small></article>)}</div>
      </section>

      <section id="contact" className="demo-contact shell">
        <small>{product.category}</small>
        <h2>Want this direction adapted to a real business?</h2>
        <a href="mailto:hello@example.com">Discuss the project ↗</a>
      </section>

      <footer className="demo-footer shell"><Link href="/">← All portfolio work</Link><span>Original concept · 2026</span></footer>
    </main>
  );
}
