import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@clerk/react';
import {
  Download,
  Shield,
  CheckCircle2,
  Copy,
  AlertTriangle,
  Loader2,
  Monitor,
  Wifi,
  KeyRound,
} from 'lucide-react';

interface SetupWizardProps {
  initialStep?: 1 | 2 | 3;
  activationCode: string;
}

function copyToClipboard(text: string, onSuccess: () => void) {
  navigator.clipboard.writeText(text).then(onSuccess).catch(() => {
    // Fallback for environments without clipboard API
    const ta = document.createElement('textarea');
    ta.value = text;
    document.body.appendChild(ta);
    ta.select();
    document.execCommand('copy');
    document.body.removeChild(ta);
    onSuccess();
  });
}

function showToast(message: string) {
  const event = new CustomEvent('show-toast', { detail: { message, type: 'success' } });
  window.dispatchEvent(event);
}

// ── Step 1: Download ────────────────────────────────────────────────────────
function StepDownload() {
  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00D4AA]/20 text-[#00D4AA] text-sm font-bold">
          1
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Deploy Discovery Agent</h2>
          <p className="mt-1 text-sm text-gray-400">
            A lightweight agent that scans your subnet for devices, open ports, and services.
            No firewall changes needed — outbound HTTPS only.
          </p>
        </div>
      </div>

      {/* System requirements */}
      <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4">
        <p className="mb-3 text-xs font-semibold uppercase tracking-wider text-gray-400">
          System Requirements
        </p>
        <ul className="space-y-2 text-sm text-gray-300">
          <li className="flex items-center gap-2">
            <Monitor className="h-3.5 w-3.5 shrink-0 text-[#00D4AA]" />
            Windows 10/11 or Windows Server 2019+, or Ubuntu 20.04+
          </li>
          <li className="flex items-center gap-2">
            <Shield className="h-3.5 w-3.5 shrink-0 text-[#00D4AA]" />
            2 vCPU, 2 GB RAM minimum
          </li>
          <li className="flex items-center gap-2">
            <Wifi className="h-3.5 w-3.5 shrink-0 text-[#00D4AA]" />
            Network access to target subnet
          </li>
        </ul>
      </div>

      {/* Download buttons */}
      <div className="space-y-2">
        <a
          href="/downloads/TekSafeAgent-Setup.exe"
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-[#00D4AA] px-5 py-3 text-sm font-semibold text-white transition-all hover:bg-[#00D4AA]/90 active:scale-[0.98]"
          onClick={(e) => e.preventDefault()}
        >
          <Download className="h-4 w-4" />
          Download Discovery Agent (.exe)
        </a>
        <a
          href="/downloads/TekSafeAgent-linux.tar.gz"
          className="block text-center text-xs text-gray-400 underline decoration-gray-600 hover:text-gray-300"
          onClick={(e) => e.preventDefault()}
        >
          Linux version (.tar.gz)
        </a>
      </div>
    </div>
  );
}

// ── Step 2: AV/Firewall Config ──────────────────────────────────────────────
function StepAntivirus({ activationCode }: { activationCode: string }) {
  const hashPreview = activationCode.replace(/-/g, '').slice(0, 8) + '...9281x';

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00D4AA]/20 text-[#00D4AA] text-sm font-bold">
          2
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Antivirus &amp; Firewall Configuration</h2>
          <p className="mt-1 text-sm text-gray-400">
            The agent performs active scanning which may trigger heuristics in EDR/AV software.
            Please add the following exclusions before running.
          </p>
        </div>
      </div>

      {/* Warning callout */}
      <div className="flex items-start gap-2.5 rounded-xl border border-orange-700/50 bg-orange-900/20 px-4 py-3">
        <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-orange-400" />
        <p className="text-sm text-orange-300">
          <span className="font-semibold">Action Required:</span> Allow outbound port{' '}
          <code className="rounded bg-orange-900/40 px-1 py-0.5 text-xs">443</code> (HTTPS) to{' '}
          <code className="rounded bg-orange-900/40 px-1 py-0.5 text-xs">api.teksafe.ai</code>
        </p>
      </div>

      {/* Hash exclusion */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-400">File Hash (add to AV exclusions)</p>
        <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 font-mono text-sm text-gray-200">
          <span className="flex-1 truncate">MD5: {hashPreview}</span>
          <button
            onClick={() => {
              copyToClipboard(`MD5: ${hashPreview}`, () => showToast('Hash copied'));
            }}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-[#00D4AA] hover:bg-gray-800"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
        </div>
      </div>

      {/* Process name exclusion */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-400">Process Name (add to AV exclusions)</p>
        <div className="flex items-center gap-2 rounded-lg border border-gray-700 bg-gray-900 px-3 py-2.5 font-mono text-sm text-gray-200">
          <span className="flex-1">TekSafeAgent.exe</span>
          <button
            onClick={() => {
              copyToClipboard('TekSafeAgent.exe', () => showToast('Process name copied'));
            }}
            className="flex items-center gap-1 rounded px-2 py-0.5 text-xs text-[#00D4AA] hover:bg-gray-800"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Step 3: Activation ──────────────────────────────────────────────────────
function StepActivation({
  activationCode,
  onActivated,
}: {
  activationCode: string;
  onActivated: () => void;
}) {
  const { getToken } = useAuth();
  const [polling, setPolling] = useState(true);
  const [checking, setChecking] = useState(false);

  const checkStatus = useCallback(async () => {
    setChecking(true);
    try {
      const token = await getToken();
      const res = await fetch('/api/infrastructure/activation', {
        headers: { Authorization: `Bearer ${token ?? ''}` },
      });
      if (res.ok) {
        const data = await res.json();
        if (data.status === 'active') {
          setPolling(false);
          onActivated();
        }
      }
    } catch {
      // non-fatal — keep polling
    } finally {
      setChecking(false);
    }
  }, [getToken, onActivated]);

  useEffect(() => {
    if (!polling) return;
    const interval = setInterval(checkStatus, 10_000);
    return () => clearInterval(interval);
  }, [polling, checkStatus]);

  return (
    <div className="space-y-5">
      <div className="flex items-start gap-3">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#00D4AA]/20 text-[#00D4AA] text-sm font-bold">
          3
        </div>
        <div>
          <h2 className="text-lg font-semibold text-white">Activate Your Agent</h2>
          <p className="mt-1 text-sm text-gray-400">
            Open TekSafeAgent after installation. Paste this code when prompted.
          </p>
        </div>
      </div>

      {/* Activation code */}
      <div className="space-y-1">
        <p className="text-xs font-medium text-gray-400 flex items-center gap-1">
          <KeyRound className="h-3 w-3" />
          Activation Code
        </p>
        <div className="flex items-center gap-2 rounded-xl border border-[#00D4AA]/40 bg-gray-900 px-4 py-3">
          <code className="flex-1 select-all font-mono text-base tracking-widest text-[#00D4AA]">
            {activationCode}
          </code>
          <button
            onClick={() => {
              copyToClipboard(activationCode, () => showToast('Activation code copied'));
            }}
            className="flex items-center gap-1 rounded-lg border border-[#00D4AA]/30 px-3 py-1.5 text-xs font-medium text-[#00D4AA] transition-colors hover:bg-[#00D4AA]/10"
          >
            <Copy className="h-3 w-3" />
            Copy
          </button>
        </div>
      </div>

      {/* Status indicator */}
      <div className="flex items-center gap-3 rounded-xl border border-gray-700 bg-gray-800/50 px-4 py-3">
        {polling ? (
          <>
            <span className="relative flex h-3 w-3">
              <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-yellow-400 opacity-75" />
              <span className="relative inline-flex h-3 w-3 rounded-full bg-yellow-400" />
            </span>
            <span className="text-sm text-gray-300">
              Waiting for agent to connect…
              {checking && <Loader2 className="ml-2 inline h-3 w-3 animate-spin" />}
            </span>
          </>
        ) : (
          <>
            <CheckCircle2 className="h-4 w-4 text-[#00D4AA]" />
            <span className="text-sm font-medium text-[#00D4AA]">Agent connected successfully!</span>
          </>
        )}
      </div>
    </div>
  );
}

// ── Wizard shell ────────────────────────────────────────────────────────────
const SetupWizard = ({ initialStep = 1, activationCode }: SetupWizardProps) => {
  const [step, setStep] = useState<1 | 2 | 3>(initialStep);
  const navigate = useNavigate();

  const handleActivated = () => {
    setTimeout(() => navigate('/infrastructure'), 1500);
  };

  const steps: { label: string }[] = [
    { label: 'Download' },
    { label: 'Configure' },
    { label: 'Activate' },
  ];

  return (
    <div className="mx-auto w-full max-w-xl px-4 py-8">
      {/* Header */}
      <div className="mb-6 flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#00D4AA]/20">
          <Shield className="h-5 w-5 text-[#00D4AA]" />
        </div>
        <div>
          <h1 className="text-lg font-semibold text-white">Infrastructure Setup</h1>
          <p className="text-sm text-gray-400">Deploy the discovery agent to map your network</p>
        </div>
      </div>

      {/* Step progress dots */}
      <div className="mb-6 flex items-center gap-2">
        {steps.map((s, i) => {
          const n = (i + 1) as 1 | 2 | 3;
          const isActive = step === n;
          const isDone = step > n;
          return (
            <div key={s.label} className="flex items-center gap-2">
              <div
                className={[
                  'flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold transition-colors',
                  isActive
                    ? 'bg-[#00D4AA] text-white'
                    : isDone
                    ? 'bg-[#00D4AA]/30 text-[#00D4AA]'
                    : 'bg-gray-700 text-gray-500',
                ].join(' ')}
              >
                {isDone ? <CheckCircle2 className="h-4 w-4" /> : n}
              </div>
              <span
                className={[
                  'text-xs',
                  isActive ? 'text-white font-medium' : 'text-gray-500',
                ].join(' ')}
              >
                {s.label}
              </span>
              {i < steps.length - 1 && (
                <div className={['h-px w-8', isDone ? 'bg-[#00D4AA]/40' : 'bg-gray-700'].join(' ')} />
              )}
            </div>
          );
        })}
        <span className="ml-auto text-xs text-gray-500">{step} of 3</span>
      </div>

      {/* Step content card */}
      <div className="rounded-2xl border border-gray-800 bg-gray-900 p-6">
        {step === 1 && <StepDownload />}
        {step === 2 && <StepAntivirus activationCode={activationCode} />}
        {step === 3 && (
          <StepActivation activationCode={activationCode} onActivated={handleActivated} />
        )}
      </div>

      {/* Navigation */}
      <div className="mt-4 flex items-center justify-between">
        <button
          onClick={() => setStep((s) => Math.max(1, s - 1) as 1 | 2 | 3)}
          disabled={step === 1}
          className="rounded-lg px-4 py-2 text-sm text-gray-400 transition-colors hover:text-gray-200 disabled:invisible"
        >
          ← Previous
        </button>
        {step < 3 ? (
          <button
            onClick={() => setStep((s) => Math.min(3, s + 1) as 1 | 2 | 3)}
            className="rounded-xl bg-[#00D4AA] px-5 py-2 text-sm font-semibold text-white transition-all hover:bg-[#00D4AA]/90 active:scale-[0.98]"
          >
            Next →
          </button>
        ) : (
          <span className="text-xs text-gray-500">Waiting for connection…</span>
        )}
      </div>
    </div>
  );
};

export default SetupWizard;
