import { useEffect, useState } from 'react';
import { useAuth, SignInButton, SignUpButton } from '@clerk/react';
import { useNavigate } from 'react-router-dom';
import {
  Shield,
  MessageSquare,
  Link2,
  Globe,
  Lock,
  Zap,
  ArrowRight,
  CheckCircle,
  Menu,
  X,
} from 'lucide-react';

// ─── Scroll animation helper ──────────────────────────────────────────────────

function useScrollReveal() {
  useEffect(() => {
    const els = document.querySelectorAll('.animate-on-scroll');
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.12 }
    );
    els.forEach((el) => observer.observe(el));
    return () => observer.disconnect();
  }, []);
}

// ─── Static chat preview ──────────────────────────────────────────────────────

function ChatPreview() {
  return (
    <div className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-2xl dark:border-gray-700 dark:bg-dark-surface">
      {/* Window chrome */}
      <div className="flex items-center gap-2 border-b border-gray-200 bg-gray-50 px-4 py-3 dark:border-gray-700 dark:bg-gray-800/60">
        <div className="flex gap-1.5">
          <div className="h-2.5 w-2.5 rounded-full bg-red-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-yellow-400" />
          <div className="h-2.5 w-2.5 rounded-full bg-green-400" />
        </div>
        <div className="mx-auto flex items-center gap-1.5 text-xs font-medium text-gray-500 dark:text-gray-400">
          <Shield className="h-3 w-3 text-accent" />
          Tek-Safe AI Chat
        </div>
      </div>

      {/* Messages */}
      <div className="space-y-4 p-4 text-sm">
        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-bubble rounded-br-[4px] bg-primary px-4 py-2.5 text-sm text-white">
            My laptop has been running really slow. What can I do?
          </div>
        </div>

        <div className="flex items-start gap-2.5">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
            <Shield className="h-3.5 w-3.5 text-accent" />
          </div>
          <div className="max-w-[82%] rounded-bubble rounded-tl-[4px] bg-gray-100 px-4 py-3 text-gray-800 dark:bg-dark-bg dark:text-gray-200">
            <p className="mb-2 font-medium">Here are the top fixes for a slow laptop:</p>
            <ul className="space-y-1 text-xs text-gray-600 dark:text-gray-400">
              {['Restart and disable startup programs', 'Free up disk space (keep 15%+ free)', 'Run a malware scan', 'Check for pending OS updates'].map((tip) => (
                <li key={tip} className="flex items-center gap-1.5">
                  <CheckCircle className="h-3 w-3 shrink-0 text-accent" />
                  {tip}
                </li>
              ))}
            </ul>
            <p className="mt-2 text-xs text-gray-500 dark:text-gray-500">
              Which OS are you on? I can give more specific steps.
            </p>
          </div>
        </div>

        <div className="flex justify-end">
          <div className="max-w-[75%] rounded-bubble rounded-br-[4px] bg-primary px-4 py-2.5 text-sm text-white">
            Windows 11
          </div>
        </div>

        <div className="flex items-center gap-2 text-xs text-gray-400 dark:text-gray-500">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 dark:bg-primary/20">
            <Shield className="h-3.5 w-3.5 text-accent" />
          </div>
          <div className="flex gap-1">
            <span className="inline-block h-2 w-2 animate-bounce-dot rounded-full bg-gray-400" style={{ animationDelay: '0ms' }} />
            <span className="inline-block h-2 w-2 animate-bounce-dot rounded-full bg-gray-400" style={{ animationDelay: '150ms' }} />
            <span className="inline-block h-2 w-2 animate-bounce-dot rounded-full bg-gray-400" style={{ animationDelay: '300ms' }} />
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Data ─────────────────────────────────────────────────────────────────────

const HOW_IT_WORKS = [
  {
    step: '01',
    icon: MessageSquare,
    title: 'Ask Anything',
    desc: 'Type your tech question or security concern in plain English — no jargon needed.',
  },
  {
    step: '02',
    icon: Zap,
    title: 'Get Expert Help',
    desc: 'Our AI gives clear, step-by-step solutions grounded in a curated knowledge base.',
  },
  {
    step: '03',
    icon: Shield,
    title: 'Stay Safe',
    desc: 'Built-in tools check breaches, scan URLs, and verify IP reputation in real time.',
  },
];

const FEATURES = [
  {
    icon: MessageSquare,
    title: 'Smart AI Chat',
    desc: 'Expert answers without jargon. Powered by DeepSeek with a curated knowledge base.',
    color: 'bg-blue-100 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400',
  },
  {
    icon: Shield,
    title: 'Breach Check',
    desc: 'Check if your email was exposed in any of 12 billion+ compromised records.',
    color: 'bg-orange-100 dark:bg-orange-900/30 text-orange-600 dark:text-orange-400',
  },
  {
    icon: Link2,
    title: 'URL Scanner',
    desc: 'Verify links with 72+ security engines before you click. Avoid phishing sites.',
    color: 'bg-purple-100 dark:bg-purple-900/30 text-purple-600 dark:text-purple-400',
  },
  {
    icon: Globe,
    title: 'IP Checker',
    desc: 'Check if an IP address has been flagged for malicious activity or abuse.',
    color: 'bg-teal-100 dark:bg-teal-900/30 text-teal-600 dark:text-teal-400',
  },
  {
    icon: Lock,
    title: 'Privacy First',
    desc: "We never log your emails, URLs, or IPs. Your data is processed in memory only.",
    color: 'bg-green-100 dark:bg-green-900/30 text-green-600 dark:text-green-400',
  },
  {
    icon: CheckCircle,
    title: 'India-Aware',
    desc: 'Context-aware for Indian users — UPI fraud, CERT-In, DPDP Act, local ISPs.',
    color: 'bg-rose-100 dark:bg-rose-900/30 text-rose-600 dark:text-rose-400',
  },
];

const USE_CASES = [
  { query: '"My laptop is slow and freezing"', result: 'Step-by-step diagnosis + fix guide', icon: '💻' },
  { query: '"Is this link safe to click?"', result: 'URL scanned by 72+ security engines', icon: '🔗' },
  { query: '"Was my email in a data breach?"', result: 'Checked against 12B+ breached records', icon: '🔐' },
  { query: '"How do I set up 2FA on Gmail?"', result: 'Clear walkthrough, no jargon', icon: '🛡️' },
];

// ─── Landing Page ─────────────────────────────────────────────────────────────

const LandingPage = () => {
  const { isSignedIn, isLoaded } = useAuth();
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useScrollReveal();

  useEffect(() => {
    if (isLoaded && isSignedIn) navigate('/chat');
  }, [isLoaded, isSignedIn, navigate]);

  return (
    <div className="min-h-screen bg-light-bg text-gray-900 dark:bg-dark-bg dark:text-white">

      {/* ── Navbar ──────────────────────────────────────────────────────────── */}
      <header className="sticky top-0 z-50 border-b border-gray-200/80 bg-white/90 backdrop-blur-md dark:border-gray-800/80 dark:bg-dark-bg/90">
        <div className="mx-auto flex max-w-6xl items-center justify-between px-6 py-3">
          {/* Logo */}
          <div className="flex items-center gap-2 font-semibold text-primary dark:text-white">
            <Shield className="h-5 w-5 text-accent" />
            <span>Tek-Safe AI</span>
          </div>

          {/* Desktop nav */}
          <nav className="hidden items-center gap-6 text-sm md:flex">
            <a href="#features" className="text-gray-600 transition-colors hover:text-primary dark:text-gray-400 dark:hover:text-white">
              Features
            </a>
            <a href="#how-it-works" className="text-gray-600 transition-colors hover:text-primary dark:text-gray-400 dark:hover:text-white">
              How It Works
            </a>
            <SignInButton mode="modal">
              <button className="rounded-[10px] px-4 py-1.5 font-medium text-gray-700 transition-colors hover:bg-gray-100 dark:text-gray-300 dark:hover:bg-gray-800">
                Sign In
              </button>
            </SignInButton>
            <SignUpButton mode="modal">
              <button className="rounded-[10px] bg-accent px-4 py-1.5 font-medium text-white shadow-sm transition-all hover:bg-accent/90 active:scale-[0.98]">
                Try Free
              </button>
            </SignUpButton>
          </nav>

          {/* Mobile menu toggle */}
          <button
            className="flex h-9 w-9 items-center justify-center rounded-lg hover:bg-gray-100 dark:hover:bg-gray-800 md:hidden"
            onClick={() => setMobileMenuOpen((o) => !o)}
            aria-label="Toggle menu"
          >
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>

        {/* Mobile menu */}
        {mobileMenuOpen && (
          <div className="border-t border-gray-200 bg-white px-6 py-4 dark:border-gray-800 dark:bg-dark-bg md:hidden">
            <div className="flex flex-col gap-3">
              <a href="#features" onClick={() => setMobileMenuOpen(false)} className="text-sm text-gray-600 dark:text-gray-400">Features</a>
              <a href="#how-it-works" onClick={() => setMobileMenuOpen(false)} className="text-sm text-gray-600 dark:text-gray-400">How It Works</a>
              <SignInButton mode="modal">
                <button className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm font-medium text-gray-700 dark:border-gray-700 dark:text-gray-300">
                  Sign In
                </button>
              </SignInButton>
              <SignUpButton mode="modal">
                <button className="w-full rounded-xl bg-accent px-4 py-2.5 text-sm font-medium text-white">
                  Try Free — No Card Required
                </button>
              </SignUpButton>
            </div>
          </div>
        )}
      </header>

      {/* ── Hero ────────────────────────────────────────────────────────────── */}
      <section className="mx-auto max-w-6xl px-6 pb-16 pt-16 md:pt-24">
        <div className="grid items-center gap-12 md:grid-cols-2">
          {/* Left: text */}
          <div>
            <div className="mb-4 inline-flex items-center gap-2 rounded-full border border-accent/30 bg-accent/10 px-3 py-1 text-xs font-medium text-accent">
              <Shield className="h-3.5 w-3.5" />
              Free · 50 messages/day · No credit card
            </div>

            <h1 className="mb-5 text-4xl font-bold leading-tight tracking-tight sm:text-5xl">
              Your AI-Powered{' '}
              <span className="text-accent">Tech Support</span>{' '}
              &amp;{' '}
              <span className="text-accent">Cybersecurity</span>{' '}
              Assistant
            </h1>

            <p className="mb-8 text-lg leading-relaxed text-gray-500 dark:text-gray-400">
              Get instant help with tech problems and stay safe online.
              No jargon, no waiting — powered by AI and real security tools.
            </p>

            <div className="flex flex-wrap gap-3">
              <SignUpButton mode="modal">
                <button className="flex items-center gap-2 rounded-xl bg-accent px-6 py-3 text-sm font-semibold text-white shadow-lg shadow-accent/25 transition-all hover:bg-accent/90 active:scale-[0.98]">
                  Try Tek-Safe AI Free
                  <ArrowRight className="h-4 w-4" />
                </button>
              </SignUpButton>
              <a
                href="#how-it-works"
                className="flex items-center gap-2 rounded-xl border border-gray-200 bg-white px-6 py-3 text-sm font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:border-gray-700 dark:bg-dark-surface dark:text-gray-300 dark:hover:bg-gray-800"
              >
                See How It Works
              </a>
            </div>

            {/* Social proof */}
            <div className="mt-8 flex flex-wrap items-center gap-4 text-xs text-gray-500 dark:text-gray-400">
              {['Breach Check', 'URL Scanner', 'IP Checker', 'AI Chat'].map((f) => (
                <span key={f} className="flex items-center gap-1">
                  <CheckCircle className="h-3.5 w-3.5 text-accent" />
                  {f}
                </span>
              ))}
            </div>
          </div>

          {/* Right: chat preview */}
          <div className="animate-on-scroll">
            <ChatPreview />
          </div>
        </div>
      </section>

      {/* ── How It Works ────────────────────────────────────────────────────── */}
      <section id="how-it-works" className="bg-white py-20 dark:bg-dark-surface">
        <div className="mx-auto max-w-6xl px-6">
          <div className="animate-on-scroll mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold">How It Works</h2>
            <p className="mx-auto max-w-xl text-gray-500 dark:text-gray-400">
              From question to solution in seconds — no expertise required.
            </p>
          </div>

          <div className="grid gap-8 md:grid-cols-3">
            {HOW_IT_WORKS.map(({ step, icon: Icon, title, desc }, i) => (
              <div
                key={step}
                className={`animate-on-scroll delay-${(i + 1) * 100} relative flex flex-col items-center text-center`}
              >
                {/* Connector line */}
                {i < HOW_IT_WORKS.length - 1 && (
                  <div className="absolute left-[calc(50%+3rem)] top-8 hidden h-0.5 w-[calc(100%-6rem)] bg-gradient-to-r from-accent/40 to-transparent md:block" />
                )}
                <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 dark:bg-accent/20">
                  <Icon className="h-7 w-7 text-accent" />
                </div>
                <div className="mb-1 text-xs font-bold uppercase tracking-widest text-accent">{step}</div>
                <h3 className="mb-2 text-lg font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────────────────────── */}
      <section id="features" className="py-20">
        <div className="mx-auto max-w-6xl px-6">
          <div className="animate-on-scroll mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold">Everything You Need</h2>
            <p className="mx-auto max-w-xl text-gray-500 dark:text-gray-400">
              One tool that covers tech support, cybersecurity advice, and real-time threat checking.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
            {FEATURES.map(({ icon: Icon, title, desc, color }, i) => (
              <div
                key={title}
                className={`animate-on-scroll delay-${(i % 3) * 100 + 100} group rounded-card border border-gray-200 bg-white p-6 shadow-sm transition-all duration-200 hover:-translate-y-1 hover:shadow-md dark:border-gray-700 dark:bg-dark-surface`}
              >
                <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${color}`}>
                  <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-2 font-semibold">{title}</h3>
                <p className="text-sm leading-relaxed text-gray-500 dark:text-gray-400">{desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── Use Cases ───────────────────────────────────────────────────────── */}
      <section className="bg-white py-20 dark:bg-dark-surface">
        <div className="mx-auto max-w-6xl px-6">
          <div className="animate-on-scroll mb-12 text-center">
            <h2 className="mb-3 text-3xl font-bold">Real Problems. Instant Help.</h2>
            <p className="mx-auto max-w-xl text-gray-500 dark:text-gray-400">
              See what Tek-Safe AI can do for you.
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            {USE_CASES.map(({ query, result, icon }, i) => (
              <div
                key={query}
                className={`animate-on-scroll delay-${(i % 2) * 100 + 100} flex items-start gap-4 rounded-card border border-gray-200 bg-light-bg p-5 dark:border-gray-700 dark:bg-dark-bg`}
              >
                <span className="text-2xl" aria-hidden="true">{icon}</span>
                <div>
                  <p className="mb-1 font-medium text-gray-800 dark:text-gray-200">{query}</p>
                  <p className="flex items-center gap-1.5 text-sm text-accent">
                    <ArrowRight className="h-3.5 w-3.5" />
                    {result}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ── CTA ─────────────────────────────────────────────────────────────── */}
      <section className="py-24">
        <div className="animate-on-scroll mx-auto max-w-2xl px-6 text-center">
          <div className="mb-6 flex justify-center">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-accent/10 dark:bg-accent/20">
              <Shield className="h-8 w-8 text-accent" />
            </div>
          </div>
          <h2 className="mb-4 text-3xl font-bold sm:text-4xl">
            Ready to Stay Safe Online?
          </h2>
          <p className="mb-2 text-gray-500 dark:text-gray-400">
            Join thousands of users getting instant AI help for tech and security.
          </p>
          <p className="mb-8 text-sm font-medium text-accent">
            Free · 50 messages/day · No credit card required
          </p>

          <SignUpButton mode="modal">
            <button className="inline-flex items-center gap-2 rounded-xl bg-accent px-8 py-3.5 text-base font-semibold text-white shadow-lg shadow-accent/30 transition-all hover:bg-accent/90 active:scale-[0.98]">
              Start Chatting with Tek-Safe AI
              <ArrowRight className="h-5 w-5" />
            </button>
          </SignUpButton>

          <p className="mt-4 text-sm text-gray-400 dark:text-gray-500">
            Already have an account?{' '}
            <SignInButton mode="modal">
              <button className="text-accent underline underline-offset-2 hover:text-accent/80">
                Sign in
              </button>
            </SignInButton>
          </p>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      <footer className="border-t border-gray-200 bg-white py-10 dark:border-gray-800 dark:bg-dark-surface">
        <div className="mx-auto max-w-6xl px-6">
          <div className="flex flex-col items-center justify-between gap-4 sm:flex-row">
            <div className="flex items-center gap-2 font-semibold text-primary dark:text-white">
              <Shield className="h-5 w-5 text-accent" />
              <span>Tek-Safe AI</span>
            </div>
            <p className="text-xs text-gray-400 dark:text-gray-500">
              Built by Tek-Safe IT Solutions · © {new Date().getFullYear()}
            </p>
            <div className="flex gap-4 text-xs text-gray-500 dark:text-gray-400">
              <a href="#" className="transition-colors hover:text-primary dark:hover:text-white">Privacy Policy</a>
              <a href="#" className="transition-colors hover:text-primary dark:hover:text-white">Terms</a>
              <a href="mailto:support@teksafe.ai" className="transition-colors hover:text-primary dark:hover:text-white">Contact</a>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
