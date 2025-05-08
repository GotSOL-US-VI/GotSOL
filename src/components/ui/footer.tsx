'use client';

import { DisclaimerButton } from './disclaimer-button';
import { FeedbackLink } from './feedback-link';
import { GitHubLink } from './github-link';
import { TwitterLink } from './twitter-link';

export function Footer() {
    return (
        <footer className="fixed bottom-0 left-0 w-full px-4 py-3 flex justify-between items-center bg-base-100/90 backdrop-blur-sm z-50 border-t border-gray-800/20">
            <div className="flex gap-4">
                <DisclaimerButton />
                <FeedbackLink />
            </div>
            <div className="flex gap-4">
                <GitHubLink />
                <TwitterLink />
            </div>
        </footer>
    );
} 