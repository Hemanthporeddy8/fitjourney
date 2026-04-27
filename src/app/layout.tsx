
import type {Metadata} from 'next';
import { GeistSans } from 'geist/font/sans';
import { GeistMono } from 'geist/font/mono';
import './globals.css';
import { Toaster } from "@/components/ui/toaster";
import { NavigationFooter } from "@/components/navigation-footer";

export const metadata: Metadata = {
  title: 'FitJourney',
  description: 'Track your fitness progress and achieve your goals with FitJourney.',
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className={`${GeistSans.variable} ${GeistMono.variable} font-sans antialiased pb-20`}>
        {children}
        <NavigationFooter />
        <Toaster />
      </body>
    </html>
  );
}
