'use client'

interface Link {
    label: string
    href: string
}

const links: Link[] = [
    { label: 'Kumbaya YouTube Channel', href: 'https://youtube.com/' },
    { label: 'Setup Your Merchant Point of Sale', href: 'https://youtube.com/' },
    { label: 'Manage Your Merchant\'s Accounts and Funds', href: 'https://youtube.com/' },
    { label: 'Create or Delete Manager and Employee Accounts', href: 'https://youtube.com/' },
    { label: 'What is Social Sign-on?', href: 'https://youtube.com/' },
    { label: 'Kumbaya Complete Guide Start-to-Finish', href: 'https://youtube.com/' },
]

export function Links() {
    return (
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {links.map((link, index) => (
                <div key={index} className="card bg-base-100 shadow-xl">
                    <div className="card-body">
                        <h2 className="card-title text-lg">{link.label}</h2>
                        <div className="card-actions justify-end">
                            <a
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary btn-sm"
                            >
                                Visit
                            </a>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}