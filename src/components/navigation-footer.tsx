
'use client';

import React from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Button } from '@/components/ui/button';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Home as HomeIcon, LineChart, Dumbbell, Camera as CameraIcon, Scale, User as UserIcon, Zap, ScanLine, UserSquare2, Smile, Map } from 'lucide-react';
import { cn } from '@/lib/utils';

export function NavigationFooter() {
  const pathname = usePathname();

  const navItems = [
    { href: '/', icon: HomeIcon, label: 'Home' },
    { href: '/progress', icon: LineChart, label: 'Progress' },
    { href: '/track', icon: Dumbbell, label: 'Track' },
    { type: 'popover' }, // Camera popover
    { href: '/buddy', icon: Zap, label: 'Buddy' },
    { href: '/ideal-body', icon: Scale, label: 'Ideal Body' },
    { href: '/face-timelapse', icon: Smile, label: 'Face' },
    { href: '/healmap', icon: Map, label: 'HealMap' },
    { href: '/profile', icon: UserIcon, label: 'Profile' },
  ];

  return (
    <footer className="fixed bottom-0 left-0 right-0 bg-card border-t p-2 text-center text-sm text-muted-foreground z-50">
      <div className="flex justify-around items-center h-full max-w-lg mx-auto">
        {navItems.map((item, index) => {
          if (item.type === 'popover') {
            const isCameraActive = pathname === '/scan' || pathname === '/upload';
            return (
              <Popover key="camera-popover">
                <PopoverTrigger asChild>
                  <button className={cn(
                    "flex flex-col items-center hover:text-primary transition-colors",
                    isCameraActive ? "text-primary font-semibold" : "text-muted-foreground"
                  )}>
                    <CameraIcon className="h-5 w-5" />
                    <span className="text-xs">Camera</span>
                  </button>
                </PopoverTrigger>
                <PopoverContent className="w-48 mb-2">
                  <div className="grid gap-4">
                    <div className="space-y-2">
                      <h4 className="font-medium leading-none">Scan Options</h4>
                      <p className="text-sm text-muted-foreground">Choose what you want to scan.</p>
                    </div>
                    <div className="grid gap-2">
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/scan" className="flex items-center">
                          <ScanLine className="mr-2 h-4 w-4" />
                          Food Scan
                        </Link>
                      </Button>
                      <Button variant="outline" size="sm" asChild>
                        <Link href="/upload" className="flex items-center">
                          <UserSquare2 className="mr-2 h-4 w-4" />
                          Body Scan
                        </Link>
                      </Button>
                    </div>
                  </div>
                </PopoverContent>
              </Popover>
            );
          }

          const Icon = item.icon!;
          const isActive = pathname === item.href;

          return (
            <Link 
              key={item.href} 
              href={item.href!} 
              className={cn(
                "flex flex-col items-center transition-colors hover:text-primary",
                isActive ? "text-primary font-semibold" : "text-muted-foreground"
              )}
            >
              <Icon className="h-5 w-5" />
              <span className="text-xs">{item.label}</span>
            </Link>
          );
        })}
      </div>
    </footer>
  );
}
