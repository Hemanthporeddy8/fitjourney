'use client';

import React, { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Download, Sparkles, X, Info } from 'lucide-react';

export function PwaInstaller() {
  const [installPrompt, setInstallPrompt] = useState<any>(null);
  const [isIOS, setIsIOS] = useState(false);
  const [isStandalone, setIsStandalone] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const [showIosTooltip, setShowIosTooltip] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;

    // Check if app is already running in standalone mode (already installed)
    const checkStandalone = 
      window.matchMedia('(display-mode: standalone)').matches ||
      (window.navigator as any).standalone === true;
    
    setIsStandalone(checkStandalone);

    // Detect iOS
    const userAgent = window.navigator.userAgent.toLowerCase();
    const isIosDevice = /iphone|ipad|ipod/.test(userAgent);
    setIsIOS(isIosDevice);

    // Listen for the Chrome/Android beforeinstallprompt event
    const handleBeforeInstallPrompt = (e: Event) => {
      e.preventDefault();
      setInstallPrompt(e);
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt);

    // Retrieve dismiss state from localStorage
    const isDismissed = localStorage.getItem('fitjourney_pwa_dismissed') === 'true';
    if (isDismissed) {
      setIsVisible(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt);
    };
  }, []);

  const handleInstallClick = async () => {
    if (installPrompt) {
      installPrompt.prompt();
      const { outcome } = await installPrompt.userChoice;
      if (outcome === 'accepted') {
        setInstallPrompt(null);
        setIsVisible(false);
      }
    } else if (isIOS) {
      setShowIosTooltip(true);
    }
  };

  const handleDismiss = () => {
    setIsVisible(false);
    localStorage.setItem('fitjourney_pwa_dismissed', 'true');
  };

  // If already installed, closed, or not supported, render nothing
  if (isStandalone || !isVisible) return null;
  if (!installPrompt && !isIOS) return null;

  return (
    <Card className="relative overflow-hidden mb-6 border-primary/20 bg-gradient-to-r from-teal-500/10 via-primary/5 to-teal-500/5 animate-in fade-in slide-in-from-top-2 duration-300">
      <button 
        onClick={handleDismiss} 
        className="absolute top-3 right-3 text-muted-foreground hover:text-foreground transition-colors p-1"
        aria-label="Dismiss"
      >
        <X className="h-4 w-4" />
      </button>

      <CardHeader className="pb-2">
        <div className="flex items-center space-x-2">
          <div className="bg-primary/20 p-1.5 rounded-full animate-bounce">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-base font-bold text-primary">Get the FitJourney Mobile App</CardTitle>
        </div>
      </CardHeader>
      
      <CardContent className="space-y-3">
        <p className="text-xs text-muted-foreground leading-relaxed">
          Install FitJourney to your home screen for a fullscreen layout, faster loading speeds, and offline workout tracking.
        </p>

        {showIosTooltip ? (
          <div className="bg-secondary/80 p-3 rounded-lg border text-xs text-foreground space-y-2 animate-in zoom-in-95">
            <div className="flex items-start space-x-2">
              <Info className="h-4 w-4 text-primary shrink-0 mt-0.5" />
              <div>
                <p className="font-semibold">To install on iPhone/iPad:</p>
                <ol className="list-decimal pl-4 mt-1 space-y-1 text-muted-foreground">
                  <li>Tap the **Share** button in Safari's bottom toolbar.</li>
                  <li>Scroll down and choose <span className="font-semibold text-foreground">Add to Home Screen</span>.</li>
                </ol>
              </div>
            </div>
            <Button size="sm" variant="ghost" className="w-full text-[10px] h-7" onClick={() => setShowIosTooltip(false)}>
              Got it
            </Button>
          </div>
        ) : (
          <Button 
            size="sm" 
            onClick={handleInstallClick} 
            className="w-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold shadow-sm flex items-center justify-center space-x-1.5 h-9"
          >
            <Download className="h-4 w-4" />
            <span>Install Web App</span>
          </Button>
        )}
      </CardContent>
    </Card>
  );
}
