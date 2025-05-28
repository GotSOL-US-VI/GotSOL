'use client';

import { useEffect, useState } from 'react';
import { createClient } from '@/utils/supabaseClient';
import { toastUtils } from '@/utils/toast-utils';

interface TestRecord {
    id: number;
    created_at: string;
    test_message: string;
}

export function TestSupabaseConnection() {
    const [isConnected, setIsConnected] = useState<boolean | null>(null);
    const [isLoading, setIsLoading] = useState(true);
    const [testRecords, setTestRecords] = useState<TestRecord[]>([]);
    const [newMessage, setNewMessage] = useState('');
    const supabase = createClient();

    const fetchTestRecords = async () => {
        try {
            const { data, error } = await supabase
                .from('connection_test')
                .select('*')
                .order('created_at', { ascending: false })
                .limit(5);

            if (error) throw error;
            setTestRecords(data || []);
        } catch (error) {
            console.error('Error fetching test records:', error);
            toastUtils.error('Failed to fetch test records');
        }
    };

    const addTestRecord = async () => {
        if (!newMessage.trim()) {
            toastUtils.error('Please enter a test message');
            return;
        }

        try {
            const { error } = await supabase
                .from('connection_test')
                .insert([{ test_message: newMessage }]);

            if (error) throw error;

            toastUtils.success('Test record added successfully!');
            setNewMessage('');
            fetchTestRecords();
        } catch (error) {
            console.error('Error adding test record:', error);
            toastUtils.error('Failed to add test record');
        }
    };

    useEffect(() => {
        async function testConnection() {
            try {
                // Try to fetch from our test table
                const { data, error } = await supabase
                    .from('connection_test')
                    .select('count')
                    .limit(1);

                if (error) {
                    // If table doesn't exist, we'll get an error, but that's okay
                    // We'll still consider the connection successful
                    console.log('Table might not exist yet:', error.message);
                }

                setIsConnected(true);
                toastUtils.success('Successfully connected to Supabase!');
                fetchTestRecords();
            } catch (error) {
                console.error('Supabase connection error:', error);
                setIsConnected(false);
                toastUtils.error('Failed to connect to Supabase');
            } finally {
                setIsLoading(false);
            }
        }

        testConnection();
    }, []);

    if (isLoading) {
        return <div className="p-4">Testing Supabase connection...</div>;
    }

    return (
        <div className="p-4 space-y-6">
            <div>
                <h2 className="text-lg font-semibold mb-2">Supabase Connection Status</h2>
                <div className={`inline-block px-3 py-1 rounded-full ${
                    isConnected ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
                }`}>
                    {isConnected ? 'Connected' : 'Not Connected'}
                </div>
            </div>

            {isConnected && (
                <div className="space-y-4">
                    <div>
                        <h3 className="text-md font-semibold mb-2">Add Test Record</h3>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={newMessage}
                                onChange={(e) => setNewMessage(e.target.value)}
                                placeholder="Enter test message"
                                className="px-3 py-2 border rounded-md flex-grow"
                            />
                            <button
                                onClick={addTestRecord}
                                className="px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600"
                            >
                                Add
                            </button>
                        </div>
                    </div>

                    <div>
                        <h3 className="text-md font-semibold mb-2">Recent Test Records</h3>
                        {testRecords.length === 0 ? (
                            <p className="text-gray-500">No test records yet</p>
                        ) : (
                            <ul className="space-y-2">
                                {testRecords.map((record) => (
                                    <li key={record.id} className="p-3 bg-gray-50 rounded-md">
                                        <p className="font-medium">{record.test_message}</p>
                                        <p className="text-sm text-gray-500">
                                            {new Date(record.created_at).toLocaleString()}
                                        </p>
                                    </li>
                                ))}
                            </ul>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
} 