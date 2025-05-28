'use client';

import { TestSupabaseConnection } from '@/components/test-supabase-connection';

export default function TestSupabasePage() {
    return (
        <div className="container mx-auto py-8">
            <h1 className="text-2xl font-bold mb-6">Supabase Connection Test</h1>
            <TestSupabaseConnection />
        </div>
    );
} 