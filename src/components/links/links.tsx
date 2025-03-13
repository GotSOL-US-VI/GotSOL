'use client'

interface Link {
    label: string
    href: string
    description: string
}

const links: Link[] = [
    { 
        label: 'Got Sol YouTube', 
        href: 'https://youtube.com/',
        description: 'Watch tutorials and guides about using Got Sol for your business'
    },
    { 
        label: 'Point of Sale Guide', 
        href: 'https://youtube.com/',
        description: 'Learn how to set up and use your merchant point of sale system'
    },
    { 
        label: 'Managing Funds', 
        href: 'https://youtube.com/',
        description: 'Understand how to manage your accounts, withdrawals, and transactions'
    },
    { 
        label: 'Team Management', 
        href: 'https://youtube.com/',
        description: 'Set up and manage accounts for your managers and employees'
    },
    { 
        label: 'Social Sign-on', 
        href: 'https://youtube.com/',
        description: 'Learn about our secure and convenient social authentication system'
    },
    { 
        label: 'Complete Guide', 
        href: 'https://youtube.com/',
        description: 'A comprehensive guide to all Got Sol features and capabilities'
    },
]

export function Links() {
    return (
        <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {links.map((link, index) => (
                <div key={index} className="card hover:border-mint/50 transition-colors">
                    <div className="card-body">
                        <h2 className="card-title text-mint">{link.label}</h2>
                        <p className="text-white/60 text-sm">{link.description}</p>
                        <div className="card-actions justify-end mt-4">
                            <a
                                href={link.href}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="btn btn-primary btn-sm"
                            >
                                Watch Guide
                            </a>
                        </div>
                    </div>
                </div>
            ))}
        </div>
    )
}