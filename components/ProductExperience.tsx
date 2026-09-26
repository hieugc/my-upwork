"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

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

function InteractiveShowcase({ tone }: { tone: string }) {
  const [index, setIndex] = useState(0);
  const [cart, setCart] = useState(0);
  const [status, setStatus] = useState("Ready");
  const [watching, setWatching] = useState(false);
  const [category, setCategory] = useState("Coffee");

  const content = useMemo(() => {
    if (tone === "chain") return [
      { label: "Launch", value: "+184%", note: "community growth" },
      { label: "Acquire", value: "−31.8%", note: "CAC improvement" },
      { label: "Retain", value: "68%", note: "30-day activation" },
    ];
    if (tone === "metric") return [
      { label: "Pipeline", value: "$3.84M", note: "+18.6% vs prior period" },
      { label: "Retention", value: "94.2%", note: "gross revenue retention" },
      { label: "Expansion", value: "$720K", note: "expansion pipeline" },
    ];
    return [];
  }, [tone]);

  if (tone === "chain" || tone === "metric") {
    const active = content[index];
    return <section className="interactive-panel shell"><div className="interactive-copy"><p className="demo-kicker">Interactive demo</p><h2>{tone === "chain" ? "Switch the growth lens." : "Change the revenue lens."}</h2><p>Use the controls to preview how the interface changes context without leaving the page.</p></div><div className="control-card"><div className="segmented">{content.map((item,i)=><button key={item.label} className={i===index?"active":""} onClick={()=>setIndex(i)}>{item.label}</button>)}</div><strong>{active.value}</strong><span>{active.note}</span><div className="sparkline" aria-hidden="true"><i/><i/><i/><i/><i/><i/></div></div></section>;
  }

  if (tone === "orbit") {
    const steps=["Intake","Classify","Human check","Ship"];
    return <section className="interactive-panel shell"><div className="interactive-copy"><p className="demo-kicker">Workflow simulator</p><h2>Run a safe automation loop.</h2><p>The demo never calls an external API. It only demonstrates state progression.</p></div><div className="control-card"><div className="workflow-list">{steps.map((step,i)=><button key={step} onClick={()=>{setIndex(i);setStatus(step+" selected")}} className={index===i?"active-row":""}><span>{String(i+1).padStart(2,"0")}</span>{step}</button>)}</div><button className="action-button" onClick={()=>setStatus("Demo workflow completed")}>Run demo workflow</button><p className="status-line" role="status">{status}</p></div></section>;
  }

  if (tone === "maison") {
    const cities=["Paris","London","Singapore"];
    const homes=[["Île Saint-Louis","€4.8M"],["Belgravia","£6.2M"],["Nassim Road","S$12.4M"]];
    return <section className="interactive-panel shell"><div className="interactive-copy"><p className="demo-kicker">Property finder</p><h2>Filter a private collection.</h2><p>A compact listing interaction for a luxury property brief.</p></div><div className="control-card"><div className="segmented">{cities.map((city,i)=><button key={city} className={i===index?"active":""} onClick={()=>setIndex(i)}>{city}</button>)}</div><div className="listing-demo"><div className="listing-image"/><div><small>{cities[index]}</small><h3>{homes[index][0]}</h3><strong>{homes[index][1]}</strong></div></div><button className="action-button" onClick={()=>setStatus("Viewing request prepared")}>Request private viewing</button><p className="status-line" role="status">{status}</p></div></section>;
  }

  if (tone === "noma") {
    const items=[["Filter coffee",65],["Cardamom bun",48],["Egg sandwich",95]] as const;
    return <section className="interactive-panel shell"><div className="interactive-copy"><p className="demo-kicker">Order & booking demo</p><h2>Build a morning order.</h2><p>Cart and booking are local demo states; no payment or personal data is sent.</p></div><div className="control-card"><div className="segmented">{["Coffee","Bakery","Breakfast"].map(x=><button key={x} className={category===x?"active":""} onClick={()=>setCategory(x)}>{x}</button>)}</div><div className="menu-demo">{items.map(([name,price])=><button key={name} onClick={()=>setCart(v=>v+price)}><span>{name}</span><b>{price}k</b><em>+</em></button>)}</div><div className="cart-line"><span>Demo cart</span><strong>{cart}k</strong></div><button className="action-button" onClick={()=>setStatus("Table request saved locally")}>Book a table</button><p className="status-line" role="status">{status}</p></div></section>;
  }

  if (tone === "aura") {
    const colors=["Clay","Ash","Sand"];
    return <section className="interactive-panel shell"><div className="interactive-copy"><p className="demo-kicker">Commerce demo</p><h2>Choose a finish, add to bag.</h2><p>A product-detail interaction with variant and cart state.</p></div><div className="control-card"><div className="product-demo"><div className={"product-object variant-"+index}/><div><small>Hand-thrown vessel</small><h3>Arc No. 04</h3><strong>$148</strong></div></div><div className="segmented">{colors.map((x,i)=><button key={x} className={index===i?"active":""} onClick={()=>setIndex(i)}>{x}</button>)}</div><button className="action-button" onClick={()=>setCart(v=>v+1)}>Add to bag · {cart} item{cart===1?"":"s"}</button></div></section>;
  }

  if (tone === "northstar") {
    const filters=["All","Identity","Product","Campaign"];
    return <section className="interactive-panel shell"><div className="interactive-copy"><p className="demo-kicker">Project canvas</p><h2>Filter work by discipline.</h2><p>The project canvas responds immediately to the selected creative discipline.</p></div><div className="control-card"><div className="segmented">{filters.map((x,i)=><button key={x} className={index===i?"active":""} onClick={()=>setIndex(i)}>{x}</button>)}</div><div className="project-canvas"><article><span>01</span><strong>{filters[index]} System</strong></article><article><span>02</span><strong>{index===0?"Digital Product":"Selected "+filters[index]}</strong></article><article><span>03</span><strong>Launch Toolkit</strong></article></div></div></section>;
  }

  return <section className="interactive-panel shell"><div className="interactive-copy"><p className="demo-kicker">Simulation only</p><h2>Inspect a treasury position.</h2><p>Watchlist and trade controls are intentionally non-executing portfolio interactions.</p></div><div className="control-card ledger-control"><div className="trade-head"><span>BTC / USD</span><strong>$102,480</strong></div><button className={"watch-button "+(watching?"watching":"")} onClick={()=>setWatching(v=>!v)}>{watching?"★ Watching":"☆ Add to watchlist"}</button><div className="trade-grid"><button onClick={()=>setStatus("BUY simulation prepared")}>Simulate buy</button><button onClick={()=>setStatus("SELL simulation prepared")}>Simulate sell</button></div><p className="status-line" role="status">{status}</p></div></section>;
}

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

      <InteractiveShowcase tone={product.tone} />

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
