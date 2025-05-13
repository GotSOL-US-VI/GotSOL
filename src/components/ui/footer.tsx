'use client';

import { DisclaimerButton } from './disclaimer-button';
import { FeedbackLink } from './feedback-link';
import { GitHubLink } from './github-link';
import { TwitterLink } from './twitter-link';
import { YouTubeLink } from './youtube-link';


export function Footer() {
    return (
        <footer className="fixed bottom-0 left-0 w-full px-4 py-4 flex justify-between items-center bg-transparent z-50">
            <div className="flex gap-4">
                <DisclaimerButton />
                <FeedbackLink />
            </div>
            <div className="flex gap-4 px-2">
                <GitHubLink />
                <TwitterLink />
                <YouTubeLink />
            </div>
        </footer>
    );
} 