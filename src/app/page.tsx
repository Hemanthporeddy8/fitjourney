
import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { 
    ScanLine, 
    Footprints, 
    Users, 
    CalendarDays, 
    Map, 
    Scale, 
    UserSquare2,
    Smile,
    Film
} from 'lucide-react'; 

interface FeatureCardProps {
  href: string;
  icon: React.ReactNode;
  title: string;
  description: string;
  className?: string;
}

const FeatureCard: React.FC<FeatureCardProps> = ({ href, icon, title, description, className }) => (
  <Link href={href} className="block hover:shadow-lg transition-shadow rounded-lg">
    <Card className={`h-full flex flex-col justify-between hover:border-primary ${className}`}>
      <CardHeader>
        <div className="flex items-center space-x-3">
            <div className="bg-primary/10 p-2 rounded-full">
                {icon}
            </div>
            <CardTitle className="text-lg font-semibold">{title}</CardTitle>
        </div>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">{description}</p>
      </CardContent>
    </Card>
  </Link>
);

export default function Home() {
  return (
    <div className="flex flex-col min-h-screen bg-secondary/50">
        <main className="flex-1 p-4 md:p-6">
            <div className="max-w-4xl mx-auto">
                <div className="mb-6">
                    <h1 className="text-2xl md:text-3xl font-bold text-primary">
                        Welcome back, Hemanth!
                    </h1>
                    <p className="text-muted-foreground">
                        Ready to continue your FitJourney?
                    </p>
                </div>
                
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    <FeatureCard
                        href="/upload"
                        icon={<UserSquare2 className="h-6 w-6 text-primary" />}
                        title="Body Progress"
                        description="Capture and scan body photos with AI analysis."
                    />
                    <FeatureCard
                        href="/body-timelapse"
                        icon={<Film className="h-6 w-6 text-primary" />}
                        title="Body Timelapse"
                        description="Watch your physical transformation come to life."
                    />
                     <FeatureCard
                        href="/ideal-body"
                        icon={<Scale className="h-6 w-6 text-primary" />}
                        title="Ideal Body Plan"
                        description="Get a sample diet & workout plan based on your metrics."
                    />
                    <FeatureCard
                        href="/scan"
                        icon={<ScanLine className="h-6 w-6 text-primary" />}
                        title="Meal Scanner"
                        description="Scan food to get instant calorie and nutrition estimates."
                        className="lg:col-span-1"
                    />
                    <FeatureCard
                        href="/track"
                        icon={<Footprints className="h-6 w-6 text-primary" />}
                        title="Activity Tracker"
                        description="Log your walks, runs, and guided exercise sessions."
                    />
                    <FeatureCard
                        href="/buddy"
                        icon={<Users className="h-6 w-6 text-primary" />}
                        title="Buddy Challenge"
                        description="Take on fun activities to burn calories and stay motivated."
                    />
                    <FeatureCard
                        href="/progress"
                        icon={<CalendarDays className="h-6 w-6 text-primary" />}
                        title="Weekly Log"
                        description="Review your meal history in a weekly calendar view."
                    />
                     <FeatureCard
                        href="/face-timelapse"
                        icon={<Smile className="h-6 w-6 text-primary" />}
                        title="Face Timelapse"
                        description="Track facial changes over time with daily photos."
                    />
                     <FeatureCard
                        href="/healmap"
                        icon={<Map className="h-6 w-6 text-primary" />}
                        title="HealMap"
                        description="A hub for specialized healing and wellness tools."
                        className="lg:col-span-2"
                    />
                </div>
            </div>
        </main>
    </div>
  );
}
