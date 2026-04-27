'use client';

import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Download, Trash2, ArrowLeft, Database, Search, Filter, CheckCircle2, XCircle } from 'lucide-react';
import Link from 'next/link';
import { useToast } from "@/hooks/use-toast";
import { format } from 'date-fns';

interface TrainingEntry {
  timestamp: string;
  originalPredictions: { name: string; conf: number }[];
  userCorrection: string;
  wasOther: boolean;
  portion: string;
  imageRef: string;
}

export default function AdminTrainingPanel() {
  const [entries, setEntries] = useState<TrainingEntry[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const { toast } = useToast();

  useEffect(() => {
    loadEntries();
  }, []);

  const loadEntries = () => {
    const data = localStorage.getItem('fitjourney_training_data');
    if (data) {
      setEntries(JSON.parse(data));
    }
  };

  const handleExport = () => {
    if (entries.length === 0) return;
    const blob = new Blob([JSON.stringify(entries, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `fitjourney_training_data_${format(new Date(), 'yyyyMMdd_HHmm')}.json`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toast({ title: 'Data Exported!', description: `${entries.length} entries downloaded for training.` });
  };

  const handleClear = () => {
    if (confirm('Are you sure you want to clear all training logs? This cannot be undone.')) {
      localStorage.removeItem('fitjourney_training_data');
      setEntries([]);
      toast({ title: 'Logs Cleared', description: 'The training database is now empty.' });
    }
  };

  const filteredEntries = entries.filter(e => 
    e.userCorrection.toLowerCase().includes(searchTerm.toLowerCase()) ||
    e.originalPredictions.some(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-background p-6 space-y-6">
      <div className="max-w-6xl mx-auto space-y-6">
        
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <Link href="/scan">
              <Button variant="outline" size="icon"><ArrowLeft className="h-4 w-4" /></Button>
            </Link>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">VisiFood Admin</h1>
              <p className="text-muted-foreground">Manage local training datasets & corrections</p>
            </div>
          </div>
          <div className="flex items-center space-x-2">
            <Button variant="outline" onClick={handleExport} disabled={entries.length === 0}>
              <Download className="mr-2 h-4 w-4" /> Export JSON
            </Button>
            <Button variant="destructive" onClick={handleClear} disabled={entries.length === 0}>
              <Trash2 className="mr-2 h-4 w-4" /> Clear Logs
            </Button>
          </div>
        </div>

        {/* Stats Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <Database className="h-4 w-4 mr-2" /> Total Entries
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{entries.length}</div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <CheckCircle2 className="h-4 w-4 mr-2 text-green-500" /> Auto-Matches
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {entries.filter(e => e.originalPredictions[0]?.name === e.userCorrection).length}
              </div>
            </CardContent>
          </Card>
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground flex items-center">
                <XCircle className="h-4 w-4 mr-2 text-amber-500" /> Manual Corrections
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {entries.filter(e => e.wasOther || e.originalPredictions[0]?.name !== e.userCorrection).length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Table View */}
        <Card>
          <CardHeader>
            <CardTitle>Training Logs</CardTitle>
            <CardDescription>Review user corrections vs AI predictions for model fine-tuning.</CardDescription>
            <div className="pt-4 flex items-center space-x-2">
               <div className="relative flex-1">
                 <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                 <input 
                   placeholder="Search entries..." 
                   className="w-full bg-secondary border-none rounded-md h-10 pl-10 pr-4 text-sm focus:ring-1 focus:ring-primary"
                   value={searchTerm}
                   onChange={(e) => setSearchTerm(e.target.value)}
                 />
               </div>
            </div>
          </CardHeader>
          <CardContent>
            {entries.length === 0 ? (
              <div className="text-center py-20 border-2 border-dashed rounded-lg">
                <Database className="mx-auto h-12 w-12 text-muted-foreground mb-4 opacity-20" />
                <p className="text-muted-foreground">No training data collected yet. Start scanning meals!</p>
              </div>
            ) : (
              <div className="rounded-md border">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Timestamp</TableHead>
                      <TableHead>AI Top Guess</TableHead>
                      <TableHead>User Selection</TableHead>
                      <TableHead>Status</TableHead>
                      <TableHead>Portion</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredEntries.map((entry, i) => {
                      const isMatch = entry.originalPredictions[0]?.name === entry.userCorrection;
                      return (
                        <TableRow key={i}>
                          <TableCell className="text-xs font-mono">
                            {format(new Date(entry.timestamp), 'MMM dd, HH:mm:ss')}
                          </TableCell>
                          <TableCell>
                            <span className="font-medium">{entry.originalPredictions[0]?.name || 'N/A'}</span>
                            <span className="ml-2 text-xs text-muted-foreground">
                              ({Math.round((entry.originalPredictions[0]?.conf || 0) * 100)}%)
                            </span>
                          </TableCell>
                          <TableCell className="font-bold text-primary">
                            {entry.userCorrection}
                          </TableCell>
                          <TableCell>
                            <Badge variant={isMatch ? 'default' : 'destructive'} className="text-[10px]">
                              {entry.wasOther ? 'MANUAL ENTRY' : isMatch ? 'MATCH' : 'CORRECTED'}
                            </Badge>
                          </TableCell>
                          <TableCell className="capitalize text-xs">
                            {entry.portion}
                          </TableCell>
                        </TableRow>
                      );
                    })}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>

      </div>
    </div>
  );
}
