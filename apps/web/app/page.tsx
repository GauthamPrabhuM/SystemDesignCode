'use client';

import Link from 'next/link';
import { motion } from 'framer-motion';
import { ArrowRight, Code2, Cpu, GitBranch, Heart, Sparkles, Terminal, Zap } from 'lucide-react';

const BMC_URL = 'https://buymeacoffee.com/gauthamprabhum';
const GITHUB_URL = 'https://github.com/GauthamPrabhuM/systemdesigncode';

export default function Landing() {
  return (
    <div className="min-h-screen bg-background text-foreground">
      <Nav />
      <Hero />
      <FeatureGrid />
      <Categories />
      <Affiliates />
      <Support />
      <Footer />
    </div>
  );
}

function Nav() {
  return (
    <nav className="sticky top-0 z-40 border-b border-border bg-background/60 backdrop-blur">
      <div className="mx-auto flex h-14 max-w-6xl items-center px-6">
        <Link href="/" className="flex items-center gap-2 font-medium tracking-tight">
          <div className="grid h-6 w-6 place-items-center rounded-md bg-foreground text-background">
            <Code2 className="h-3.5 w-3.5" />
          </div>
          SystemDesignCode
        </Link>
        <div className="ml-auto flex items-center gap-1 text-sm">
          <Link href="/problems" className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">Problems</Link>
          <Link href="/contests" className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground">Contests</Link>
          <Link
            href={GITHUB_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="rounded-md px-3 py-1.5 text-muted-foreground hover:text-foreground"
          >
            GitHub
          </Link>
          <Link
            href={BMC_URL}
            target="_blank"
            rel="noopener noreferrer"
            className="ml-1 inline-flex items-center gap-1.5 rounded-md bg-[#FFDD00] px-3 py-1.5 text-[#000000] hover:opacity-90"
          >
            <Heart className="h-3.5 w-3.5 fill-current" /> Support
          </Link>
          <Link href="/login" className="ml-1 rounded-md border border-border px-3 py-1.5 hover:bg-accent">Sign in</Link>
          <Link href="/register" className="rounded-md bg-foreground px-3 py-1.5 text-background hover:opacity-90">Get started</Link>
        </div>
      </div>
    </nav>
  );
}

function Hero() {
  return (
    <section className="relative overflow-hidden border-b border-border">
      <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle_at_top,_oklch(0.30_0.15_250_/_0.18),_transparent_60%)]" />
      <div className="mx-auto max-w-6xl px-6 py-24">
        <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6 }}>
          <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/50 px-3 py-1 text-xs text-muted-foreground">
            <Sparkles className="h-3 w-3" /> AI-graded design reviews · now in beta
          </span>
        </motion.div>
        <motion.h1
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.05, duration: 0.6 }}
          className="mt-6 max-w-3xl text-5xl font-semibold tracking-tight md:text-6xl"
        >
          The interview platform for <span className="text-muted-foreground">backend engineers.</span>
        </motion.h1>
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.6 }}
          className="mt-4 max-w-2xl text-lg text-muted-foreground"
        >
          Practice machine coding, low-level design, and distributed systems rounds in a real IDE. Get instant tests, runtime stats, and AI design reviews from a senior engineer's perspective.
        </motion.p>
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15, duration: 0.6 }}
          className="mt-8 flex flex-wrap items-center gap-3"
        >
          <Link
            href="/register"
            className="inline-flex items-center gap-2 rounded-md bg-foreground px-5 py-2.5 text-sm font-medium text-background hover:opacity-90"
          >
            Start solving <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/problems/parking-lot"
            className="inline-flex items-center gap-2 rounded-md border border-border px-5 py-2.5 text-sm hover:bg-accent"
          >
            Try a sample problem
          </Link>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.25, duration: 0.7 }}
          className="mt-14"
        >
          <AnimatedTerminal />
        </motion.div>
      </div>
    </section>
  );
}

function AnimatedTerminal() {
  const lines = [
    { t: 'cmd', text: '$ sdc run parking-lot --lang=java' },
    { t: 'sys', text: 'building sandbox...' },
    { t: 'sys', text: 'starting Main' },
    { t: 'ok',  text: '✓ park_one_car             4ms' },
    { t: 'ok',  text: '✓ park_and_unpark_hour     6ms' },
    { t: 'ok',  text: '✓ free_spots_after_park    3ms' },
    { t: 'ok',  text: '✓ concurrent_100_threads  82ms' },
    { t: 'sys', text: '' },
    { t: 'sys', text: 'tests:  4/4 passed' },
    { t: 'sys', text: 'score:  92 / 100' },
    { t: 'ai',  text: 'AI: Good use of Strategy for pricing. Consider extracting' },
    { t: 'ai',  text: 'spot allocation into its own class (SRP).' },
  ];
  return (
    <div className="overflow-hidden rounded-xl border border-border bg-[oklch(0.10_0_0)] shadow-2xl shadow-black/40">
      <div className="flex items-center gap-1.5 border-b border-border px-3 py-2">
        <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
        <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
        <span className="ml-3 text-xs text-muted-foreground">~ sdc</span>
      </div>
      <pre className="overflow-x-auto p-5 font-mono text-[13px] leading-relaxed">
        {lines.map((l, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 + i * 0.12 }}
            className={
              l.t === 'cmd'
                ? 'text-foreground'
                : l.t === 'ok'
                ? 'text-emerald-400'
                : l.t === 'ai'
                ? 'text-sky-400'
                : 'text-muted-foreground'
            }
          >
            {l.text || ' '}
          </motion.div>
        ))}
      </pre>
    </div>
  );
}

function FeatureGrid() {
  const features = [
    {
      icon: <Terminal className="h-4 w-4" />,
      title: 'Real IDE, real code',
      body: 'Monaco editor with multi-file support, six languages, autosave drafts. Not a toy textbox.',
    },
    {
      icon: <Cpu className="h-4 w-4" />,
      title: 'Sandboxed execution',
      body: 'Your code runs in isolated gVisor containers with per-test timeouts and resource caps.',
    },
    {
      icon: <Sparkles className="h-4 w-4" />,
      title: 'AI design review',
      body: 'After tests pass, get structured feedback on SOLID, patterns, extensibility, concurrency.',
    },
    {
      icon: <Zap className="h-4 w-4" />,
      title: 'Interview mode',
      body: 'Time-boxed rounds with proctoring, shared cursors, and architecture whiteboard.',
    },
    {
      icon: <GitBranch className="h-4 w-4" />,
      title: 'Track progress',
      body: 'Heatmaps, streaks, company-tagged sets. Built for serious 8–12 week prep cycles.',
    },
    {
      icon: <Code2 className="h-4 w-4" />,
      title: 'Open source',
      body: 'Self-host the whole stack with one docker compose command. MIT licensed.',
    },
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-medium tracking-tight">Built for the rounds that decide offers.</h2>
        <div className="mt-10 grid gap-4 md:grid-cols-3">
          {features.map((f, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 8 }}
              whileInView={{ opacity: 1, y: 0 }}
              viewport={{ once: true }}
              transition={{ delay: i * 0.04 }}
              className="rounded-lg border border-border bg-muted/20 p-5"
            >
              <div className="mb-3 grid h-7 w-7 place-items-center rounded-md bg-muted text-foreground">
                {f.icon}
              </div>
              <h3 className="text-sm font-medium">{f.title}</h3>
              <p className="mt-1.5 text-sm leading-relaxed text-muted-foreground">{f.body}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
}

function Categories() {
  const cats = [
    { name: 'Parking Lot', tag: 'LLD · Medium' },
    { name: 'Splitwise', tag: 'LLD · Medium' },
    { name: 'Rate Limiter', tag: 'DistSys · Hard' },
    { name: 'In-memory KV Store', tag: 'DistSys · Hard' },
    { name: 'LRU Cache', tag: 'LLD · Easy' },
    { name: 'BookMyShow', tag: 'LLD · Hard' },
    { name: 'TinyURL', tag: 'API · Medium' },
    { name: 'Job Scheduler', tag: 'DistSys · Hard' },
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-medium tracking-tight">A curated catalogue, not 3,000 LeetCode dupes.</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Every problem is hand-written by senior engineers, with rubrics, hidden tests, and reference solutions.
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {cats.map((c) => (
            <Link
              key={c.name}
              href={`/problems/${c.name.toLowerCase().replace(/ /g, '-')}`}
              className="group rounded-lg border border-border bg-muted/10 p-4 transition-colors hover:bg-muted/30"
            >
              <div className="text-sm font-medium">{c.name}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{c.tag}</div>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}

function Affiliates() {
  const resources = [
    {
      title: 'Designing Data-Intensive Applications',
      author: 'Martin Kleppmann',
      tag: 'Book · Must-read',
      href: 'https://amzn.to/3RzDDIA',
    },
    {
      title: 'Grokking the System Design Interview',
      author: 'Educative.io',
      tag: 'Course · Beginner-friendly',
      href: 'https://www.educative.io/courses/grokking-modern-system-design-interview-for-engineers-managers?aff=systemdesigncode',
    },
    {
      title: 'System Design Interview Vol. 1 & 2',
      author: 'Alex Xu',
      tag: 'Book · Interview-focused',
      href: 'https://amzn.to/3RzwqMv',
    },
    {
      title: 'InterviewReady by Gaurav Sen',
      author: 'Gaurav Sen',
      tag: 'Course · Advanced',
      href: 'https://interviewready.io/?ref=systemdesigncode',
    },
  ];
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <h2 className="text-2xl font-medium tracking-tight">Recommended resources.</h2>
        <p className="mt-2 text-sm text-muted-foreground">
          Hand-picked books and courses that pair well with this platform.{' '}
          <span className="text-muted-foreground/60">(Affiliate links — help keep the lights on at no extra cost to you.)</span>
        </p>
        <div className="mt-8 grid gap-3 sm:grid-cols-2 md:grid-cols-4">
          {resources.map((r) => (
            <a
              key={r.title}
              href={r.href}
              target="_blank"
              rel="noopener noreferrer sponsored"
              className="group rounded-lg border border-border bg-muted/10 p-4 transition-colors hover:bg-muted/30"
            >
              <div className="text-xs text-muted-foreground/70">{r.tag}</div>
              <div className="mt-1 text-sm font-medium leading-snug">{r.title}</div>
              <div className="mt-0.5 text-xs text-muted-foreground">{r.author}</div>
              <div className="mt-3 text-xs text-muted-foreground group-hover:text-foreground">View →</div>
            </a>
          ))}
        </div>
      </div>
    </section>
  );
}

function Support() {
  return (
    <section className="border-b border-border">
      <div className="mx-auto max-w-6xl px-6 py-20">
        <div className="mx-auto max-w-2xl text-center">
          <h2 className="text-2xl font-medium tracking-tight">100% free. Forever.</h2>
          <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
            SystemDesignCode is open source and free for everyone. If it helps you land an offer,
            consider buying me a coffee — it directly funds server costs, new problems, and AI review credits.
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
            <a
              href={BMC_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md bg-[#FFDD00] px-6 py-3 text-sm font-medium text-[#000000] hover:opacity-90"
            >
              <Heart className="h-4 w-4 fill-current" />
              Buy me a coffee
            </a>
            <a
              href={GITHUB_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-md border border-border px-6 py-3 text-sm hover:bg-accent"
            >
              Star on GitHub
            </a>
          </div>
          <p className="mt-6 text-xs text-muted-foreground/60">
            Self-host for free with <code className="font-mono">docker compose up</code> · MIT licensed · PRs welcome
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer() {
  return (
    <footer className="border-t border-border">
      <div className="mx-auto max-w-6xl px-6 py-8 text-xs text-muted-foreground">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <span>© {new Date().getFullYear()} SystemDesignCode · MIT License</span>
          <div className="flex flex-wrap gap-4">
            <Link href="/docs" className="hover:text-foreground">Docs</Link>
            <Link href="/changelog" className="hover:text-foreground">Changelog</Link>
            <a href={GITHUB_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">GitHub</a>
            <a href={BMC_URL} target="_blank" rel="noopener noreferrer" className="hover:text-foreground">Buy me a coffee ☕</a>
            <Link href="/privacy" className="hover:text-foreground">Privacy</Link>
          </div>
        </div>
        <p className="mt-3 text-muted-foreground/50">
          Some links on this page are affiliate links. We earn a small commission at no extra cost to you.
        </p>
      </div>
    </footer>
  );
}
