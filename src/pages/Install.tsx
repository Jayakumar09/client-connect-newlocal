import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Download, Smartphone, Check } from "lucide-react";
import { useNavigate } from "react-router-dom";

const Install = () => {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isInstallable, setIsInstallable] = useState(false);
  const [isInstalled, setIsInstalled] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Check if app is already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsInstalled(true);
    }

    const handler = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e);
      setIsInstallable(true);
    };

    window.addEventListener('beforeinstallprompt', handler);

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) {
      return;
    }

    deferredPrompt.prompt();
    const { outcome } = await deferredPrompt.userChoice;

    if (outcome === 'accepted') {
      setIsInstalled(true);
      setDeferredPrompt(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-primary/5 flex items-center justify-center p-4">
      <Card className="max-w-md w-full">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4">
            <img 
              src="/src/assets/sri-lakshmi-logo.png" 
              alt="Sri Lakshmi Mangalya Malai" 
              className="w-32 h-32 mx-auto object-contain"
            />
          </div>
          <CardTitle className="text-3xl font-cursive text-center bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
            SRI LAKSHMI MANGALYA MALAI
          </CardTitle>
          <CardDescription>
            Install our app on your phone for the best experience
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-6">
          {isInstalled ? (
            <div className="text-center space-y-4">
              <div className="mx-auto w-16 h-16 bg-green-500/10 rounded-full flex items-center justify-center">
                <Check className="w-8 h-8 text-green-500" />
              </div>
              <div>
                <h3 className="font-semibold text-lg mb-2">App Installed!</h3>
                <p className="text-sm text-muted-foreground">
                  You can now use the app from your home screen
                </p>
              </div>
              <Button onClick={() => navigate("/")} className="w-full">
                Go to Dashboard
              </Button>
            </div>
          ) : (
            <>
              <div className="space-y-3">
                <h3 className="font-semibold">Benefits:</h3>
                <ul className="space-y-2 text-sm text-muted-foreground">
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Works offline - Access your records anytime</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Faster loading - Instant access to your data</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>App-like experience - Full screen, no browser UI</span>
                  </li>
                  <li className="flex items-start gap-2">
                    <Check className="w-4 h-4 text-primary mt-0.5 flex-shrink-0" />
                    <span>Home screen icon - Quick access like native apps</span>
                  </li>
                </ul>
              </div>

              {isInstallable ? (
                <Button onClick={handleInstall} className="w-full" size="lg">
                  <Download className="w-5 h-5 mr-2" />
                  Install App
                </Button>
              ) : (
                <div className="space-y-3">
                  <div className="bg-muted/50 p-4 rounded-lg space-y-2 text-sm">
                    <h4 className="font-semibold">Manual Installation:</h4>
                    <div className="space-y-2 text-muted-foreground">
                      <p className="font-medium">On Android (Chrome):</p>
                      <ol className="list-decimal list-inside space-y-1 pl-2">
                        <li>Tap the menu (⋮) in the browser</li>
                        <li>Select "Install app" or "Add to Home Screen"</li>
                        <li>Tap "Install" in the popup</li>
                      </ol>
                      
                      <p className="font-medium mt-3">On iPhone (Safari):</p>
                      <ol className="list-decimal list-inside space-y-1 pl-2">
                        <li>Tap the Share button (square with arrow)</li>
                        <li>Scroll down and tap "Add to Home Screen"</li>
                        <li>Tap "Add" in the top right</li>
                      </ol>
                    </div>
                  </div>
                  <Button onClick={() => navigate("/")} variant="outline" className="w-full">
                    Continue in Browser
                  </Button>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default Install;
