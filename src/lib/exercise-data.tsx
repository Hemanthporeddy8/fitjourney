
import { Zap, Dumbbell } from 'lucide-react';
import React from 'react';

export interface Exercise {
    id: string;
    name: string;
    description: string;
    caloriesPerMinute: number;
    durationMinutes: number;
    reps?: string;
    sets?: string;
    icon?: React.ReactNode;
    // You can replace these placeholder URLs with your actual video files.
    // For example, you could place videos in the /public folder and link to them like '/videos/jumping_jacks.mp4'
    videoUrl: string; 
    imageUrl?: string;
}

export const suggestedExercises: Exercise[] = [
    { 
        id: '1', 
        name: 'Jumping Jacks', 
        description: 'Full body cardio.', 
        caloriesPerMinute: 10, 
        durationMinutes: 5, 
        reps: "Continuous", 
        sets: "1 set", 
        icon: <Zap className="h-4 w-4 text-yellow-500" />,
        videoUrl: '/videos/jumping_jacks.mp4',
        imageUrl: 'https://placehold.co/1280x720.png?text=Jumping+Jacks+Image'
    },
    { 
        id: '2', 
        name: 'High Knees', 
        description: 'Cardio exercise.', 
        caloriesPerMinute: 9, 
        durationMinutes: 5, 
        reps: "Continuous", 
        sets: "1 set", 
        icon: <Zap className="h-4 w-4 text-green-500" />,
        videoUrl: '/videos/high_knees.mp4',
        imageUrl: 'https://placehold.co/1280x720.png?text=High+Knees+Image'
    },
    { 
        id: '3', 
        name: 'Squats', 
        description: 'Strengthens legs and core.', 
        caloriesPerMinute: 8, 
        durationMinutes: 5, 
        reps: "12-15 reps", 
        sets: "3 sets", 
        icon: <Dumbbell className="h-4 w-4 text-blue-500" />,
        videoUrl: '/videos/squats.mp4',
        imageUrl: 'https://placehold.co/1280x720.png?text=Squats+Image'
    },
    { 
        id: '4', 
        name: 'Push-ups', 
        description: 'Upper body strength.', 
        caloriesPerMinute: 7, 
        durationMinutes: 2, 
        reps: "AMRAP", 
        sets: "3 sets", 
        icon: <Dumbbell className="h-4 w-4 text-purple-500" />,
        videoUrl: '/videos/pushups.mp4',
        imageUrl: 'https://placehold.co/1280x720.png?text=Push-ups+Image'
    },
    { 
        id: '5', 
        name: 'Burpees', 
        description: 'High-intensity, full body.', 
        caloriesPerMinute: 12, 
        durationMinutes: 3, 
        reps: "10-12 reps", 
        sets: "3 sets", 
        icon: <Zap className="h-4 w-4 text-red-500" />,
        videoUrl: '/videos/burpees.mp4',
        imageUrl: 'https://placehold.co/1280x720.png?text=Burpees+Image'
    },
    {
        id: '6',
        name: 'Plank',
        description: 'Core stability exercise.',
        caloriesPerMinute: 5,
        durationMinutes: 1,
        reps: 'Hold',
        sets: '3 sets',
        icon: <Dumbbell className="h-4 w-4 text-gray-500" />,
        videoUrl: '/videos/planks.mp4',
        imageUrl: 'https://placehold.co/1280x720.png?text=Plank+Image'
    },
    {
        id: '7',
        name: 'Lunges',
        description: 'Leg and glute strength.',
        caloriesPerMinute: 6,
        durationMinutes: 4,
        reps: '10-12 per leg',
        sets: '3 sets',
        icon: <Dumbbell className="h-4 w-4 text-orange-500" />,
        videoUrl: '/videos/lunges.mp4',
        imageUrl: 'https://placehold.co/1280x720.png?text=Lunges+Image'
    },
    {
        id: '8',
        name: 'Crunches',
        description: 'Abdominal core exercise.',
        caloriesPerMinute: 6,
        durationMinutes: 3,
        reps: '15-20 reps',
        sets: '3 sets',
        icon: <Dumbbell className="h-4 w-4 text-indigo-500" />,
        videoUrl: '/videos/crunches.mp4',
        imageUrl: 'https://placehold.co/1280x720.png?text=Crunches+Image'
    },
    {
        id: '9',
        name: 'Mountain Climbers',
        description: 'Cardio and core strength.',
        caloriesPerMinute: 11,
        durationMinutes: 3,
        reps: 'Continuous',
        sets: '1 set',
        icon: <Zap className="h-4 w-4 text-teal-500" />,
        videoUrl: '/videos/high_knees.mp4',
        imageUrl: 'https://placehold.co/1280x720.png?text=Mountain+Climbers+Image'
    },
];

export const getExerciseById = (id: string): Exercise | undefined => {
    return suggestedExercises.find(ex => ex.id === id);
};
