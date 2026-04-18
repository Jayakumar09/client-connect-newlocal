import { AlertTriangle, ExternalLink, Copy, Check } from 'lucide-react';
import { useState } from 'react';

interface EnvErrorProps {
  missingVars: string[];
}

export function EnvError({ missingVars }: EnvErrorProps) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    const envContent = missingVars.map(v => `${v}=your-value-here`).join('\n');
    navigator.clipboard.writeText(envContent);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <div className="max-w-lg w-full space-y-6">
        <div className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-yellow-100 dark:bg-yellow-900/30 flex items-center justify-center">
            <AlertTriangle className="w-8 h-8 text-yellow-600 dark:text-yellow-500" />
          </div>
          <h1 className="text-2xl font-bold text-foreground">Configuration Required</h1>
          <p className="text-muted-foreground">
            This application requires environment variables to be configured.
          </p>
        </div>

        <div className="bg-card border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold text-foreground">Missing Environment Variables:</h2>
          <ul className="space-y-2">
            {missingVars.map((v) => (
              <li key={v} className="flex items-center gap-2 text-sm">
                <span className="w-2 h-2 rounded-full bg-destructive" />
                <code className="bg-muted px-2 py-1 rounded text-muted-foreground">{v}</code>
              </li>
            ))}
          </ul>
        </div>

        <div className="bg-card border rounded-lg p-4 space-y-4">
          <h2 className="font-semibold text-foreground">How to Fix:</h2>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground">
            <li>Create a <code className="bg-muted px-1 rounded">.env</code> file in the project root</li>
            <li>Copy the variables from <code className="bg-muted px-1 rounded">.env.example</code></li>
            <li>Fill in your actual values</li>
            <li>Restart the development server or redeploy</li>
          </ol>

          <button
            onClick={handleCopy}
            className="inline-flex items-center gap-2 text-sm text-primary hover:underline"
          >
            {copied ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
            {copied ? 'Copied!' : 'Copy template'}
          </button>
        </div>

        <div className="bg-muted/50 border rounded-lg p-4">
          <h3 className="font-medium text-foreground mb-2">For Cloudflare Pages Deployment:</h3>
          <p className="text-sm text-muted-foreground mb-2">
            Go to your Cloudflare Pages project → Settings → Environment Variables and add:
          </p>
          <ul className="text-sm text-muted-foreground space-y-1">
            {missingVars.map((v) => (
              <li key={v}>
                <code className="bg-muted px-1 rounded">{v}</code>
              </li>
            ))}
          </ul>
          <a
            href="https://developers.cloudflare.com/pages/platform/build-configuration/#environment-variables"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-sm text-primary hover:underline mt-2"
          >
            Cloudflare Pages Docs <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    </div>
  );
}
