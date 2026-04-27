
'use client';

import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { ArrowLeft, Clock } from 'lucide-react';

export default function PureTimePage() {
  return (
    <div className="flex flex-col min-h-screen bg-background p-4 pb-20">
      <Link href="/" className="text-sm text-primary hover:underline absolute top-4 left-4 flex items-center z-10">
        <ArrowLeft className="h-4 w-4 mr-1" /> Back Home
      </Link>
      <Card className="w-full max-w-2xl mx-auto shadow-lg mt-10">
        <CardHeader className="text-center">
          <CardTitle className="text-3xl font-bold text-primary flex items-center justify-center">
            <Clock className="mr-2 h-7 w-7" /> PureTime
          </CardTitle>
          <CardDescription>This is the PureTime page. Feature coming soon!</CardDescription>
        </CardHeader>
        <CardContent className="text-center">
          <p className="text-muted-foreground">
            The PureTime feature is under construction. Check back later!
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
