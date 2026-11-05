'use strict';
/**
 * Costruttori di meta tag e dati strutturati JSON-LD (schema.org).
 * Un unico @graph per pagina con entità collegate da @id: è il formato
 * che Google, Bing e i motori generativi interpretano meglio.
 */
const config = require('../config');
const settings = require('./settings');
const { lines, stripMd, truncate } = require('./utils');

const abs = (p) => (!p ? '' : /^https?:\/\//.test(p) ? p : config.siteUrl + (p.startsWith('/') ? p : '/' + p));
const ORG_ID = () => config.siteUrl + '/#organization';
const SITE_ID = () => config.siteUrl + '/#website';

function organization() {
  const s = settings.all();
  return {
    '@type': ['Organization', 'NewsMediaOrganization'],
    '@id': ORG_ID(),
    name: s.organization_name || s.site_name,
    url: config.siteUrl + '/',
    logo: { '@type': 'ImageObject', url: abs('/img/logo-512.png'), width: 512, height: 512 },
    sameAs: lines(s.social_profiles),
    email: s.contact_email || undefined,
    publishingPrinciples: abs('/p/metodologia-editoriale'),
    ethicsPolicy: abs('/p/metodologia-editoriale'),
    correctionsPolicy: abs('/p/metodologia-editoriale'),
    actionableFeedbackPolicy: abs('/p/contatti'),
  };
}
function website() {
  const s = settings.all();
  return {
    '@type': 'WebSite',
    '@id': SITE_ID(),
    url: config.siteUrl + '/',
    name: s.site_name,
    description: s.site_description,
    inLanguage: s.site_language,
    publisher: { '@id': ORG_ID() },
    potentialAction: {
      '@type': 'SearchAction',
      target: { '@type': 'EntryPoint', urlTemplate: config.siteUrl + '/cerca?q={search_term_string}' },
      'query-input': 'required name=search_term_string',
    },
  };
}
function breadcrumb(items) {
  return {
    '@type': 'BreadcrumbList',
    '@id': abs(items[items.length - 1].url) + '#breadcrumb',
    itemListElement: items.map((it, i) => ({ '@type': 'ListItem', position: i + 1, name: it.name, item: abs(it.url) })),
  };
}
function person(u) {
  if (!u) return null;
  return {
    '@type': 'Person',
    '@id': abs(`/autore/${u.slug}`) + '#person',
    name: u.name,
    url: abs(`/autore/${u.slug}`),
    jobTitle: u.job_title || undefined,
    description: u.bio || undefined,
    image: u.avatar ? abs(u.avatar) : undefined,
    knowsAbout: u.expertise ? u.expertise.split(',').map((x) => x.trim()).filter(Boolean) : undefined,
    sameAs: lines(u.same_as),
    worksFor: { '@id': ORG_ID() },
  };
}

const TYPE_MAP = { news: 'NewsArticle', analysis: 'AnalysisNewsArticle', review: 'Review', guide: 'Article', list: 'Article' };

function article(a, { faq, steps, sources, tags, url }) {
  const s = settings.all();
  const nodes = [];
  const type = TYPE_MAP[a.type] || 'Article';
  const art = {
    '@type': type === 'Review' ? 'Article' : type,
    '@id': url + '#article',
    headline: truncate(a.title, 110),
    description: a.meta_description || a.excerpt || truncate(stripMd(a.tldr), 160),
    abstract: a.tldr || undefined,
    image: a.cover_image ? [abs(a.cover_image)] : [abs(s.default_og_image)],
    datePublished: a.published_at,
    dateModified: a.updated_at || a.published_at,
    author: a.author ? { '@id': abs(`/autore/${a.author.slug}`) + '#person' } : { '@id': ORG_ID() },
    publisher: { '@id': ORG_ID() },
    mainEntityOfPage: { '@type': 'WebPage', '@id': url },
    isPartOf: { '@id': SITE_ID() },
    articleSection: a.category_name || undefined,
    keywords: [a.focus_keyword, ...(tags || []).map((t) => t.name)].filter(Boolean).join(', ') || undefined,
    wordCount: a.word_count || undefined,
    inLanguage: s.site_language,
    isAccessibleForFree: true,
    // Speakable: indica agli assistenti vocali quali sezioni leggere (AEO)
    speakable: { '@type': 'SpeakableSpecification', cssSelector: ['.tldr', '.takeaways'] },
    citation: sources?.length ? sources.map((x) => ({ '@type': 'CreativeWork', name: x.title, url: x.url, publisher: x.publisher || undefined })) : undefined,
  };
  if (a.sponsored) art.sponsor = { '@id': ORG_ID() };
  nodes.push(art);
  if (a.author) nodes.push(person(a.author));
  if (faq?.length) {
    nodes.push({
      '@type': 'FAQPage',
      '@id': url + '#faq',
      mainEntity: faq.map((f) => ({ '@type': 'Question', name: f.q, acceptedAnswer: { '@type': 'Answer', text: f.a } })),
    });
  }
  if (steps?.length) {
    nodes.push({
      '@type': 'HowTo',
      '@id': url + '#howto',
      name: a.title,
      description: a.tldr || a.excerpt,
      step: steps.map((st, i) => ({ '@type': 'HowToStep', position: i + 1, name: st.name, text: st.text, url: `${url}#step-${i + 1}` })),
    });
  }
  return nodes;
}

function graph(...nodes) {
  const clean = (o) => JSON.parse(JSON.stringify(o, (k, v) => (Array.isArray(v) && !v.length ? undefined : v)));
  return clean({ '@context': 'https://schema.org', '@graph': [organization(), website(), ...nodes.flat().filter(Boolean)] });
}

// Serializzazione sicura dentro <script type="application/ld+json">
const jsonLdScript = (obj) => `<script type="application/ld+json">${JSON.stringify(obj).replace(/</g, '\\u003c')}</script>`;

/** Meta di base per ogni pagina */
function meta(opts = {}) {
  const s = settings.all();
  const title = opts.title ? (opts.rawTitle ? opts.title : `${opts.title} | ${s.site_name}`) : `${s.site_name} — ${s.site_tagline}`;
  return {
    title,
    ogTitle: opts.ogTitle || opts.title || s.site_name,
    description: truncate(opts.description || s.site_description, 165),
    canonical: abs(opts.canonical || opts.path || '/'),
    type: opts.type || 'website',
    image: abs(opts.image || s.default_og_image),
    imageAlt: opts.imageAlt || s.site_name,
    robots: opts.noindex ? 'noindex, follow' : 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1',
    publishedAt: opts.publishedAt,
    modifiedAt: opts.modifiedAt,
    section: opts.section,
    tags: opts.tags || [],
    authorName: opts.authorName,
    markdownAlt: opts.markdownAlt,
    prev: opts.prev, next: opts.next,
    jsonld: opts.jsonld ? jsonLdScript(opts.jsonld) : jsonLdScript(graph(...(opts.nodes || []))),
  };
}

module.exports = { abs, meta, graph, breadcrumb, article, person, organization, website, jsonLdScript, ORG_ID, SITE_ID };
